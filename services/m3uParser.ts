import { Channel, PlaylistData } from '../types';

export const parseM3U = (content: string): PlaylistData => {
  // Handle both CRLF and LF line endings
  const lines = content.split(/\r?\n/);
  const channels: Channel[] = [];
  const groups = new Set<string>();

  let currentChannel: Partial<Channel> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const info = line.substring(8); // Remove '#EXTINF:' prefix

      // 1. Extract Attributes via Global Regex
      // This matches key="value" patterns anywhere in the line
      const attributesRegex = /([a-zA-Z0-9-]+)="([^"]*)"/g;
      let match;
      let lastAttributeEndIndex = 0;
      
      let logo: string | null = null;
      let group = 'Uncategorized';

      while ((match = attributesRegex.exec(info)) !== null) {
        const [_, key, value] = match;
        const lowerKey = key.toLowerCase();
        
        if (lowerKey === 'tvg-logo') {
          logo = value;
        } else if (lowerKey === 'group-title') {
          group = value || 'Uncategorized';
        }
        
        // Track the end of the last matched attribute
        lastAttributeEndIndex = attributesRegex.lastIndex;
      }
      
      if (!group || group.trim() === '') {
          group = 'Uncategorized';
      }
      groups.add(group);

      // 2. Extract Channel Name
      // Logic: The name usually follows the comma that comes AFTER the last attribute.
      // If no attributes were found, it follows the first comma (standard format).
      
      // Find the comma starting search from where the last attribute ended
      const commaIndex = info.indexOf(',', lastAttributeEndIndex);
      
      let name = 'Unknown Channel';
      
      if (commaIndex !== -1) {
        // Standard case: take everything after the comma
        name = info.substring(commaIndex + 1).trim();
      } else {
        // Edge case: No comma found after attributes. 
        // Try to take the remaining string after the last attribute.
        if (lastAttributeEndIndex > 0 && lastAttributeEndIndex < info.length) {
            name = info.substring(lastAttributeEndIndex).trim();
        } else if (lastAttributeEndIndex === 0) {
            // No attributes and no comma found (very malformed), use whole line
            name = info.trim();
        }
      }

      // Cleanup: sometimes names might start with a stray hyphen if parsing failed slightly
      if (name.startsWith('- ') && name.length > 2) name = name.substring(2);

      currentChannel = {
        id: crypto.randomUUID(),
        name: name || 'Unknown Channel',
        logo,
        group,
      };

    } else if (!line.startsWith('#')) {
      // It's a URL (line doesn't start with #)
      // Check if it's a valid-looking stream link (http/https/rtmp etc)
      
      if (currentChannel) {
        channels.push({
          ...currentChannel,
          url: line,
        } as Channel);
        currentChannel = null; // Reset for next channel
      } else {
        // Orphan URL found without #EXTINF metadata
        // Create a generic entry for it so it's not lost
        const group = 'Uncategorized';
        groups.add(group);
        channels.push({
          id: crypto.randomUUID(),
          name: `Channel ${channels.length + 1}`,
          logo: null,
          group,
          url: line,
        });
      }
    }
  }

  return {
    channels,
    groups: Array.from(groups).sort(),
  };
};