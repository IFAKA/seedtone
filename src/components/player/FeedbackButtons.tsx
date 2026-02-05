'use client';

import { memo, useState, useCallback, useEffect, ReactNode } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { GlassButton } from '../ui';

interface FeedbackButtonsProps {
  onLike: () => void;
  onDislike: () => void;
  songId?: string | null;
  centerSlot?: ReactNode;
}

export const FeedbackButtons = memo(function FeedbackButtons({ onLike, onDislike, songId, centerSlot }: FeedbackButtonsProps) {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  useEffect(() => {
    setLiked(false);
    setDisliked(false);
  }, [songId]);

  const handleLike = useCallback(() => {
    if (liked) {
      // Undo like
      setLiked(false);
    } else {
      setLiked(true);
      setDisliked(false);
      onLike();
    }
  }, [liked, onLike]);

  const handleDislike = useCallback(() => {
    if (!disliked) {
      // Dislike skips the song, so no undo possible
      setDisliked(true);
      setLiked(false);
      onDislike();
    }
  }, [disliked, onDislike]);

  return (
    <div className="flex items-center gap-4 md:gap-6">
      <GlassButton
        variant="default"
        size="lg-responsive"
        onClick={handleDislike}
        className={disliked ? 'text-error' : 'text-text-muted hover:text-text'}
        aria-label="Dislike this song"
      >
        <ThumbsDown fill={disliked ? 'currentColor' : 'none'} />
      </GlassButton>

      {centerSlot}

      <GlassButton
        variant="default"
        size="lg-responsive"
        onClick={handleLike}
        className={liked ? 'text-success' : 'text-text-muted hover:text-text'}
        aria-label="Like this song"
      >
        <ThumbsUp fill={liked ? 'currentColor' : 'none'} />
      </GlassButton>
    </div>
  );
});
