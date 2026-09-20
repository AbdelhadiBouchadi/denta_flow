import React from 'react';
import { createAvatar } from '@dicebear/core';
import { botttsNeutral, initials } from '@dicebear/collection';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';

interface GeneratedAvatarProps {
  seed: string;
  className?: string;
  variant: 'botttsneutral' | 'initials';
}

const GeneratedAvatar = ({
  seed,
  className,
  variant,
}: GeneratedAvatarProps) => {
  let avatar;

  if (variant === 'botttsneutral') {
    avatar = createAvatar(botttsNeutral, { seed });
  } else {
    avatar = createAvatar(initials, { seed, fontWeight: 500, fontSize: 42 });
  }

  return (
    <Avatar className={cn(className)}>
      <AvatarImage src={avatar.toDataUri()} alt="Avatar Image" />
      <AvatarFallback>{seed.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
};

export default GeneratedAvatar;
