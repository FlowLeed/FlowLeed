import React from 'react';
import { Facebook, Instagram, MessageCircle, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MessagingChannelKey,
  MessagingChannelValues,
  resolveMessagingChannels,
} from '@/lib/messagingChannels';

const ICONS: Record<MessagingChannelKey, React.ElementType> = {
  telegram: Send,
  facebook: Facebook,
  whatsapp: MessageCircle,
  instagram: Instagram,
};

interface MessagingChannelLinksProps {
  contact: MessagingChannelValues | null | undefined;
  /** Icon size in pixels. */
  size?: 'sm' | 'md';
  className?: string;
}

/** Compact row of one-click chat icons for whichever channels a contact has. */
export const MessagingChannelLinks: React.FC<MessagingChannelLinksProps> = ({
  contact,
  size = 'sm',
  className = '',
}) => {
  const channels = resolveMessagingChannels(contact);
  if (channels.length === 0) return null;

  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {channels.map((channel) => {
        const Icon = ICONS[channel.key];
        return (
          <a
            key={channel.key}
            href={channel.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={`${channel.label}: ${channel.display}`}
            aria-label={`Open ${channel.label} chat`}
            className={`action-button p-1 rounded-full hover:bg-muted transition-colors ${channel.colorClass}`}
          >
            <Icon className={iconClass} />
          </a>
        );
      })}
    </div>
  );
};

interface MessagingChannelsCardProps {
  contact: MessagingChannelValues | null | undefined;
}

/** Profile card listing each messaging handle with a direct chat link. */
export const MessagingChannelsCard: React.FC<MessagingChannelsCardProps> = ({ contact }) => {
  const channels = resolveMessagingChannels(contact);
  if (channels.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" />
          Messaging
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {channels.map((channel) => {
          const Icon = ICONS[channel.key];
          return (
            <a
              key={channel.key}
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 group"
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${channel.colorClass}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{channel.label}</p>
                <p className="text-sm text-muted-foreground truncate group-hover:text-primary transition-colors">
                  {channel.display}
                </p>
              </div>
            </a>
          );
        })}
      </CardContent>
    </Card>
  );
};
