import { type FC } from "react";

import { VideoSummary } from "./VideoSummary";

export interface VideoCardProps {
	videoId: string;
	title: string;
	channelTitle: string;
	thumbnail: string;
	publishedAt: string;
	viewCount: number;
	summary: string;
	sentiment: "bullish" | "bearish" | "neutral";
	relevance: number;
	score: number;
	url: string;
}

function formatViews(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M views`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K views`;
	return `${n} views`;
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

export const VideoCard: FC<VideoCardProps> = (v) => {
	return (
		<article className="yt-card">
			<a className="yt-thumb" href={v.url} target="_blank" rel="noreferrer noopener">
				{v.thumbnail ? (
					<img src={v.thumbnail} alt={v.title} loading="lazy" />
				) : (
					<div style={{ width: "100%", height: "100%" }} />
				)}
				<span className="yt-score" title="Video Score">
					{v.score.toFixed(1)}
				</span>
				<span className="yt-views">{formatViews(v.viewCount)}</span>
			</a>
			<div className="yt-body">
				<h3 className="yt-card-title">
					<a href={v.url} target="_blank" rel="noreferrer noopener" style={{ color: "inherit", textDecoration: "none" }}>
						{v.title}
					</a>
				</h3>
				<div className="yt-channel">
					{v.channelTitle} · {formatDate(v.publishedAt)}
				</div>
				<VideoSummary summary={v.summary} sentiment={v.sentiment} />
				<div className="yt-actions">
					<a className="yt-btn" href={v.url} target="_blank" rel="noreferrer noopener">
						YouTube 에서 보기
					</a>
					<span className="yt-btn yt-btn-ghost" title="관련도 (0~1)">
						관련도 {(v.relevance * 100).toFixed(0)}%
					</span>
				</div>
			</div>
		</article>
	);
};

export default VideoCard;
