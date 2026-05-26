"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface UseVideoPlayerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isFullscreen: boolean;
  playbackRate: number;
  buffered: number;
  togglePlay: () => void;
  toggleMute: () => void;
  setVolume: (v: number) => void;
  seek: (time: number) => void;
  seekPercent: (percent: number) => void;
  toggleFullscreen: () => void;
  setPlaybackRate: (rate: number) => void;
}

export function useVideoPlayer(): UseVideoPlayerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [buffered, setBuffered] = useState(0);

  // Sync ref to state to force-trigger bindings when video enters the DOM
  useEffect(() => {
    if (videoRef.current !== videoElement) {
      setVideoElement(videoRef.current);
    }
  });

  useEffect(() => {
    if (!videoElement) return;

    const onTimeUpdate = () => setCurrentTime(videoElement.currentTime);
    const onDurationChange = () => setDuration(videoElement.duration || 0);
    const onLoadedMetadata = () => setDuration(videoElement.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onProgress = () => {
      if (videoElement.buffered.length > 0) {
        setBuffered(videoElement.buffered.end(videoElement.buffered.length - 1));
      }
    };
    const onVolumeChange = () => {
      setVolumeState(videoElement.volume);
      setIsMuted(videoElement.muted);
    };

    // Sync initial state values
    setIsPlaying(!videoElement.paused);
    setDuration(videoElement.duration || 0);
    setCurrentTime(videoElement.currentTime || 0);
    setVolumeState(videoElement.volume);
    setIsMuted(videoElement.muted);
    videoElement.playbackRate = playbackRate;
    if (videoElement.buffered.length > 0) {
      setBuffered(videoElement.buffered.end(videoElement.buffered.length - 1));
    }

    videoElement.addEventListener("timeupdate", onTimeUpdate);
    videoElement.addEventListener("durationchange", onDurationChange);
    videoElement.addEventListener("loadedmetadata", onLoadedMetadata);
    videoElement.addEventListener("play", onPlay);
    videoElement.addEventListener("pause", onPause);
    videoElement.addEventListener("ended", onEnded);
    videoElement.addEventListener("progress", onProgress);
    videoElement.addEventListener("volumechange", onVolumeChange);

    return () => {
      videoElement.removeEventListener("timeupdate", onTimeUpdate);
      videoElement.removeEventListener("durationchange", onDurationChange);
      videoElement.removeEventListener("loadedmetadata", onLoadedMetadata);
      videoElement.removeEventListener("play", onPlay);
      videoElement.removeEventListener("pause", onPause);
      videoElement.removeEventListener("ended", onEnded);
      videoElement.removeEventListener("progress", onProgress);
      videoElement.removeEventListener("volumechange", onVolumeChange);
    };
  }, [videoElement]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const setVolume = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, v));
    if (v > 0 && video.muted) video.muted = false;
  }, []);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, video.duration || 0));
  }, []);

  const seekPercent = useCallback((percent: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = (percent / 100) * (video.duration || 0);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const container = video.parentElement?.parentElement;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false));
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);

  return {
    videoRef,
    isPlaying,
    isMuted,
    currentTime,
    duration,
    volume,
    isFullscreen,
    playbackRate,
    buffered,
    togglePlay,
    toggleMute,
    setVolume,
    seek,
    seekPercent,
    toggleFullscreen,
    setPlaybackRate,
  };
}
