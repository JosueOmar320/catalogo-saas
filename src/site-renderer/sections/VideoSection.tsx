import { parseVideoUrl } from '@/lib/site/video';
import { Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import styles from '../site.module.css';
import type { SectionProps } from './types';

const RATIO = { '16:9': '16 / 9', '4:3': '4 / 3', '1:1': '1 / 1', '9:16': '9 / 16' } as const;

export function VideoSection({ section, site, env }: SectionProps<'video'>) {
  const { content } = section;
  const video = content.url ? parseVideoUrl(content.url, { autoplay: content.autoplay }) : null;
  if (!video && env.mode === 'public') return null;
  const player = video && (
    <div className={styles.videoFrame} style={{ aspectRatio: RATIO[content.ratio], maxWidth: content.ratio === '9:16' ? 420 : undefined }}>
      {video.kind === 'file' ? (
        <video src={video.src} controls={!content.autoplay} autoPlay={content.autoplay} muted={content.autoplay} loop={content.autoplay} playsInline preload="metadata" />
      ) : (
        <iframe
          src={video.embed}
          title={content.title || 'Video'}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  );
  const split = content.layout === 'split';
  return (
    <SectionFrame section={section} theme={site.theme}>
      {!split && <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center />}
      <Placeholder show={!video}>{content.url ? 'El enlace no es un video de YouTube, Vimeo, .mp4 o .webm.' : 'Pega el enlace de un video de YouTube, Vimeo o un archivo .mp4.'}</Placeholder>
      {split ? (
        <div className={styles.videoSplit}>
          <div>
            <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />
            {content.body && <p className={styles.preLine}>{content.body}</p>}
          </div>
          {player}
        </div>
      ) : (
        player && <div className={styles.videoCenter}>{player}</div>
      )}
    </SectionFrame>
  );
}
