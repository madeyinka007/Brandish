// Responsive 16:9 YouTube embed for video-format posts. Uses youtube-nocookie for privacy and
// lazy-loads the iframe. The hatch backdrop shows until the player loads.
export default function VideoEmbed({ videoId, title }: { videoId: string; title: string }) {
  return (
    <div className="hatch relative aspect-video w-full overflow-hidden">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`}
        title={title}
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
