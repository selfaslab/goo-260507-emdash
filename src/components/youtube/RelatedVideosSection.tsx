import { useEffect, useMemo, useRef, useState, type FC } from "react";

import { VideoCard, type VideoCardProps } from "./VideoCard";

import "./youtube.css";

interface ApiResponse {
	ok: boolean;
	keywords?: string[];
	videos?: VideoApiItem[];
	note?: string;
	error?: string;
}

interface VideoApiItem {
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

export interface RelatedVideosSectionProps {
	postSlug: string;
	postTitle: string;
	postBody?: string;
	targetEtf?: string;
	tickers?: string[];
	persist?: boolean;
}

type LoadState =
	| { kind: "idle" }
	| { kind: "loading" }
	| { kind: "ready"; keywords: string[]; videos: VideoCardProps[] }
	| { kind: "empty"; keywords: string[]; reason?: string }
	| { kind: "error"; message: string };

export const RelatedVideosSection: FC<RelatedVideosSectionProps> = (props) => {
	const [state, setState] = useState<LoadState>({ kind: "idle" });
	const fetchedRef = useRef(false);

	const requestBody = useMemo(
		() => ({
			title: props.postTitle,
			body: props.postBody?.slice(0, 4000) ?? "",
			etf: props.targetEtf,
			tickers: props.tickers ?? [],
			persist: props.persist ?? false,
		}),
		[props.postTitle, props.postBody, props.targetEtf, props.tickers, props.persist],
	);

	useEffect(() => {
		if (fetchedRef.current) return;
		fetchedRef.current = true;
		const controller = new AbortController();
		setState({ kind: "loading" });

		void (async () => {
			try {
				const res = await fetch("/api/fetch-youtube", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(requestBody),
					signal: controller.signal,
				});
				const json = (await res.json()) as ApiResponse;
				if (!json.ok) {
					setState({ kind: "error", message: json.error ?? `HTTP ${res.status}` });
					return;
				}
				const videos = (json.videos ?? []).map(
					(v): VideoCardProps => ({
						videoId: v.videoId,
						title: v.title,
						channelTitle: v.channelTitle,
						thumbnail: v.thumbnail,
						publishedAt: v.publishedAt,
						viewCount: v.viewCount,
						summary: v.summary,
						sentiment: v.sentiment,
						relevance: v.relevance,
						score: v.score,
						url: v.url,
					}),
				);
				if (videos.length === 0) {
					setState({ kind: "empty", keywords: json.keywords ?? [], reason: json.note });
					return;
				}
				setState({ kind: "ready", keywords: json.keywords ?? [], videos });
			} catch (e) {
				if ((e as { name?: string }).name === "AbortError") return;
				const message = e instanceof Error ? e.message : String(e);
				setState({ kind: "error", message });
			}
		})();

		return () => {
			controller.abort();
		};
	}, [requestBody]);

	return (
		<section className="yt-section" aria-labelledby={`yt-${props.postSlug}-title`}>
			<header className="yt-head">
				<div>
					<h2 id={`yt-${props.postSlug}-title`} className="yt-title">
						관련 YouTube 투자 영상
					</h2>
					<p className="yt-sub">
						AI 가 본 글의 키워드로 YouTube 를 검색해 ETF 투자 관점에서 요약·점수화한 추천입니다.
					</p>
				</div>
				{state.kind === "ready" && state.keywords.length > 0 && (
					<div className="yt-keywords" aria-label="search keywords">
						{state.keywords.map((k) => (
							<span key={k} className="yt-chip">
								{k}
							</span>
						))}
					</div>
				)}
			</header>

			{state.kind === "loading" && <SkeletonGrid />}

			{state.kind === "ready" && (
				<div className="yt-grid">
					{state.videos.map((v) => (
						<VideoCard key={v.videoId} {...v} />
					))}
				</div>
			)}

			{state.kind === "empty" && (
				<div className="yt-empty">
					<p>추천할 만한 최근 영상이 없습니다.</p>
					<small>
						키워드: {state.keywords.join(", ") || "—"}
						{state.reason ? ` · ${state.reason}` : ""}
					</small>
				</div>
			)}

			{state.kind === "error" && (
				<div className="yt-empty">
					<p>YouTube 추천을 불러오지 못했습니다.</p>
					<small>
						<code>{state.message}</code>
					</small>
				</div>
			)}
		</section>
	);
};

const SkeletonGrid: FC = () => (
	<div className="yt-grid" aria-hidden>
		{Array.from({ length: 3 }).map((_, i) => (
			<div className="yt-skel" key={i}>
				<div className="yt-skel-thumb" />
				<div className="yt-skel-line" />
				<div className="yt-skel-line short" />
				<div className="yt-skel-line" />
				<div className="yt-skel-line last short" />
			</div>
		))}
	</div>
);

export default RelatedVideosSection;
