import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { TimelineSchema, MediaFileMetadata, Clip } from '../types';

export const ffmpegService = {
  /**
   * Probe media file to extract metadata
   */
  getMediaMetadata(filePath: string): Promise<Partial<MediaFileMetadata>> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        const duration = metadata.format.duration !== undefined ? Number(metadata.format.duration) : 5;
        const width = videoStream?.width || 1920;
        const height = videoStream?.height || 1080;
        
        let fps = 30;
        if (videoStream?.r_frame_rate) {
          const parts = videoStream.r_frame_rate.split('/');
          if (parts.length === 2 && parseFloat(parts[1]) > 0) {
            fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
          }
        }

        resolve({
          duration,
          width,
          height,
          fps,
          resolution: width && height ? `${width}x${height}` : '1920x1080',
          hasAudio: !!audioStream
        });
      });
    });
  },

  /**
   * Generate video thumbnail frame
   */
  generateThumbnail(videoPath: string, outputThumbPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const folder = path.dirname(outputThumbPath);
      const filename = path.basename(outputThumbPath);

      ffmpeg(videoPath)
        .on('end', () => resolve(outputThumbPath))
        .on('error', (err) => reject(err))
        .screenshots({
          count: 1,
          timestamps: ['0.5'],
          folder: folder,
          filename: filename,
          size: '320x180'
        });
    });
  },

  /**
   * Complex Timeline Renderer: Base Canvas Overlay Engine
   * Uses loop=loop=-1:size=1:start=0 filter for universal image support (AVIF, PNG, JPG, WEBP)
   */
  renderTimeline(
    timeline: TimelineSchema,
    getFileById: (id: string) => MediaFileMetadata | undefined,
    outputPath: string,
    onProgress: (percent: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const { canvas, tracks, textOverlays } = timeline;
        const targetWidth = canvas.width || 1920;
        const targetHeight = canvas.height || 1080;
        const targetFps = canvas.fps || 30;

        const videoTracks = tracks.filter(t => t.type === 'video' && !t.muted);
        const audioTracks = tracks.filter(t => t.type === 'audio' && !t.muted);

        const videoClips: Clip[] = [];
        videoTracks.forEach(vt => {
          vt.clips.forEach(c => videoClips.push(c));
        });

        const audioClips: Clip[] = [];
        audioTracks.forEach(at => {
          at.clips.forEach(c => audioClips.push(c));
        });

        if (videoClips.length === 0) {
          return reject(new Error('No video or image clips present in timeline to render'));
        }

        const maxVideoEnd = Math.max(5, ...videoClips.map(c => c.start + (c.duration || 5)));
        const maxAudioEnd = audioClips.length > 0 ? Math.max(...audioClips.map(c => c.start + (c.duration || 5))) : 0;
        const maxTextEnd = textOverlays.length > 0 ? Math.max(...textOverlays.map(t => t.end)) : 0;
        const totalDuration = Math.max(maxVideoEnd, maxAudioEnd, maxTextEnd, 3);

        const cmd = ffmpeg();
        const complexFilter: string[] = [];

        // 1. Base Canvas Background Stream
        complexFilter.push(
          `color=c=black:s=${targetWidth}x${targetHeight}:r=${targetFps}:d=${totalDuration.toFixed(2)}[bg_base]`
        );

        let inputIndex = 0;
        let lastCanvasOut = 'bg_base';
        const audioStreamLabels: string[] = [];

        // 2. Process Video & Image Clips
        videoClips.forEach((clip, idx) => {
          const fileMeta = getFileById(clip.fileId);
          if (!fileMeta || !fs.existsSync(fileMeta.path)) {
            throw new Error(`Media file not found for clip "${clip.name}" (fileId: ${clip.fileId})`);
          }

          const isImage = fileMeta.mimeType.startsWith('image/') || fileMeta.originalName.match(/\.(avif|webp|png|jpg|jpeg|gif)$/i);
          const trimIn = clip.trimIn || 0;
          const durationSec = Math.max(0.2, clip.duration || 5);
          const trimOut = clip.trimOut || (trimIn + durationSec);
          const speed = clip.speed || 1.0;
          const filterType = clip.filter || 'none';

          cmd.input(fileMeta.path);
          const currentInput = inputIndex++;
          let vPrep = '';

          if (isImage) {
            // Universal Image Loop Filter
            vPrep = `[${currentInput}:v]loop=loop=-1:size=1:start=0,trim=duration=${durationSec.toFixed(2)},setpts=PTS-STARTPTS,scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,fps=${targetFps},format=yuv420p`;
          } else {
            vPrep = `[${currentInput}:v]trim=start=${trimIn.toFixed(2)}:end=${trimOut.toFixed(2)},setpts=PTS-STARTPTS`;
            if (speed !== 1.0) {
              vPrep += `,setpts=${(1 / speed).toFixed(4)}*PTS`;
            }
            vPrep += `,scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,fps=${targetFps},format=yuv420p`;
          }

          if (filterType === 'grayscale') {
            vPrep += `,hue=s=0`;
          } else if (filterType === 'sepia') {
            vPrep += `,colorchannelscaler=0.393:0.769:0.189:0:0.349:0.686:0.168:0:0.272:0.534:0.131:0`;
          } else if (filterType === 'invert') {
            vPrep += `,negate`;
          } else if (filterType === 'bright') {
            vPrep += `,eq=brightness=0.2:contrast=1.2`;
          } else if (filterType === 'contrast') {
            vPrep += `,eq=contrast=1.5`;
          }

          const clipPrepLabel = `vprep_${idx}`;
          complexFilter.push(`${vPrep}[${clipPrepLabel}]`);

          const nextCanvasOut = `canvas_${idx}`;
          const startTimeSec = clip.start || 0;
          const endTimeSec = startTimeSec + durationSec;

          complexFilter.push(
            `[${lastCanvasOut}][${clipPrepLabel}]overlay=x=0:y=0:enable='between(t,${startTimeSec.toFixed(2)},${endTimeSec.toFixed(2)})':eof_action=pass[${nextCanvasOut}]`
          );
          lastCanvasOut = nextCanvasOut;

          // Video Audio Stream
          if (!isImage && fileMeta.hasAudio) {
            const delayMs = Math.round(startTimeSec * 1000);
            let aPrep = `[${currentInput}:a]atrim=start=${trimIn.toFixed(2)}:end=${trimOut.toFixed(2)},asetpts=PTS-STARTPTS`;
            if (speed !== 1.0 && speed >= 0.5 && speed <= 2.0) {
              aPrep += `,atempo=${speed}`;
            }
            if (delayMs > 0) {
              aPrep += `,adelay=${delayMs}|${delayMs}`;
            }
            const volume = clip.volume !== undefined ? clip.volume : 1.0;
            if (volume !== 1.0) {
              aPrep += `,volume=${volume}`;
            }
            const aLabel = `aclip_${idx}`;
            complexFilter.push(`${aPrep}[${aLabel}]`);
            audioStreamLabels.push(aLabel);
          }
        });

        // 3. Dedicated Audio Clips
        audioClips.forEach((aclip, idx) => {
          const fileMeta = getFileById(aclip.fileId);
          if (fileMeta && fs.existsSync(fileMeta.path)) {
            cmd.input(fileMeta.path);
            const currentInput = inputIndex++;
            const trimIn = aclip.trimIn || 0;
            const durationSec = aclip.duration || 5;
            const trimOut = aclip.trimOut || (trimIn + durationSec);
            const delayMs = Math.round((aclip.start || 0) * 1000);

            let aPrep = `[${currentInput}:a]atrim=start=${trimIn.toFixed(2)}:end=${trimOut.toFixed(2)},asetpts=PTS-STARTPTS`;
            if (delayMs > 0) {
              aPrep += `,adelay=${delayMs}|${delayMs}`;
            }
            const volume = aclip.volume !== undefined ? aclip.volume : 1.0;
            if (volume !== 1.0) {
              aPrep += `,volume=${volume}`;
            }
            const aLabel = `bgaudio_${idx}`;
            complexFilter.push(`${aPrep}[${aLabel}]`);
            audioStreamLabels.push(aLabel);
          }
        });

        // 4. Text Overlays
        let currentVideoOut = lastCanvasOut;
        if (textOverlays && textOverlays.length > 0) {
          textOverlays.forEach((overlay, idx) => {
            const nextVideoOut = `v_text_${idx}`;
            const escapedText = overlay.text
              .replace(/\\/g, '\\\\')
              .replace(/'/g, "'\\\\''")
              .replace(/:/g, '\\:')
              .replace(/%/g, '\\%');

            const posX = Math.round((overlay.x / 100) * targetWidth);
            const posY = Math.round((overlay.y / 100) * targetHeight);
            const fontSize = overlay.fontSize || 36;
            const fontColor = overlay.fontColor || 'white';
            const startTime = overlay.start || 0;
            const endTime = overlay.end || 10;

            let drawtextStr = `drawtext=text='${escapedText}':x=${posX}:y=${posY}:fontsize=${fontSize}:fontcolor=${fontColor}`;
            drawtextStr += `:enable='between(t,${startTime.toFixed(2)},${endTime.toFixed(2)})'`;

            if (overlay.backgroundColor) {
              drawtextStr += `:box=1:boxcolor=${overlay.backgroundColor}@0.6:boxborderw=10`;
            }

            complexFilter.push(`[${currentVideoOut}]${drawtextStr}[${nextVideoOut}]`);
            currentVideoOut = nextVideoOut;
          });
        }

        const finalVideoLabel = currentVideoOut;

        // 5. Audio Mixing
        let finalAudioLabel: string | null = null;
        if (audioStreamLabels.length > 0) {
          if (audioStreamLabels.length === 1) {
            finalAudioLabel = audioStreamLabels[0];
          } else {
            const audioInputs = audioStreamLabels.map(l => `[${l}]`).join('');
            complexFilter.push(`${audioInputs}amix=inputs=${audioStreamLabels.length}:dropout_transition=0[a_mixed]`);
            finalAudioLabel = 'a_mixed';
          }
        }

        cmd.complexFilter(complexFilter);

        cmd.map(`[${finalVideoLabel}]`);
        if (finalAudioLabel) {
          cmd.map(`[${finalAudioLabel}]`);
          cmd.audioCodec('aac');
          cmd.audioBitrate('192k');
        }

        cmd.videoCodec('libx264')
          .outputOptions([
            '-preset ultrafast',
            '-crf 23',
            '-pix_fmt yuv420p',
            '-movflags +faststart'
          ])
          .output(outputPath);

        cmd.on('start', (cmdline) => {
          console.log('[FFmpeg Command Execution]:', cmdline);
        });

        cmd.on('progress', (progress) => {
          if (progress.percent) {
            onProgress(Math.min(99, Math.round(progress.percent)));
          } else if (progress.timemark && totalDuration > 0) {
            const parts = progress.timemark.split(':');
            if (parts.length === 3) {
              const seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
              const pct = Math.min(99, Math.round((seconds / totalDuration) * 100));
              onProgress(pct);
            }
          }
        });

        cmd.on('end', () => {
          onProgress(100);
          resolve(outputPath);
        });

        cmd.on('error', (err, stdout, stderr) => {
          console.error('[FFmpeg Error]', err.message);
          console.error('[FFmpeg Stderr]', stderr);
          reject(new Error(`FFmpeg rendering failed: ${err.message}`));
        });

        cmd.run();
      } catch (err: any) {
        reject(err);
      }
    });
  }
};
