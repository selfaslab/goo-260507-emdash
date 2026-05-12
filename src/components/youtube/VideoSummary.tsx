import { type FC } from "react";

export interface VideoSummaryProps {
	summary: string;
	sentiment: "bullish" | "bearish" | "neutral";
}

const sentClass: Record<VideoSummaryProps["sentiment"], string> = {
	bullish: "yt-sent yt-sent-bull",
	bearish: "yt-sent yt-sent-bear",
	neutral: "yt-sent yt-sent-neu",
};

const sentLabel: Record<VideoSummaryProps["sentiment"], string> = {
	bullish: "강세",
	bearish: "약세",
	neutral: "중립",
};

export const VideoSummary: FC<VideoSummaryProps> = ({ summary, sentiment }) => {
	return (
		<div>
			<div className="yt-meta">
				<span className={sentClass[sentiment]}>{sentLabel[sentiment]}</span>
			</div>
			<p className="yt-summary">{summary}</p>
		</div>
	);
};

export default VideoSummary;
