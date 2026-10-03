import React, { useState } from 'react';

export async function resizePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw Error('Choose a JPG, PNG or WebP photo.');
  }

  if (file.size > 20 * 1024 * 1024) {
    throw Error('Choose a photo smaller than 20 MB.');
  }

  const url = URL.createObjectURL(file);

  try {
    const photo = new Image();

    await new Promise((resolve, reject) => {
      photo.onload = resolve;
      photo.onerror = () =>
        reject(Error('This photo could not be opened.'));
      photo.src = url;
    });

    if (!photo.naturalWidth || !photo.naturalHeight) {
      throw Error('Invalid photo.');
    }

    const scale = Math.min(
      1,
      1600 / Math.max(photo.naturalWidth, photo.naturalHeight)
    );

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(
      1, Math.round(photo.naturalWidth * scale)
    );
    canvas.height = Math.max(
      1, Math.round(photo.naturalHeight * scale)
    );

    const context = canvas.getContext('2d');

    if (!context) {
      throw Error('Your browser cannot resize this photo.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(photo, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );

    if (!blob) throw Error('Photo compression failed.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function photoUrl(source, width = 800) {
  if (!source) return '';

  try {
    const url = new URL(source);

    if (
      url.hostname === 'res.cloudinary.com' &&
      url.pathname.includes('/image/upload/')
    ) {
      url.pathname = url.pathname.replace(
        '/image/upload/',
        `/image/upload/c_limit,w_${width},f_auto,q_auto/`
      );
      return url.href;
    }
  } catch {}

  return source;
}

export function MediaGallery({
  media = [],
  image = '',
  name = 'Product'
}) {
  const entries = media.length
    ? media
    : image
      ? [{ type: 'image', url: image }]
      : [];

  const [selected, setSelected] = useState(0);

  const current = entries[
    Math.min(selected, Math.max(0, entries.length - 1))
  ];

  if (!current) return <p>No media added yet.</p>;

  return (
    <div>
      {current.type === 'video' ? (
        <video
          key={current.url}
          src={current.url}
          controls
          playsInline
          preload="metadata"
          style={{ width: '100%', maxHeight: 420 }}
        />
      ) : (
        <img
          src={photoUrl(current.url, 1200)}
          alt={name}
          style={{
            width: '100%',
            maxHeight: 420,
            objectFit: 'contain'
          }}
        />
      )}

      <div style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginTop: 12
      }}>
        {entries.map((entry, index) => (
          <button
            key={entry.url}
            type="button"
            aria-label={
              'View ' + entry.type + ' ' + (index + 1)
            }
            aria-pressed={index === selected}
            onClick={() => setSelected(index)}
          >
            {entry.type === 'video'
              ? '▶ Video ' + (index + 1)
              : (
                <img
                  src={photoUrl(entry.url, 160)}
                  alt={'Photo ' + (index + 1)}
                  style={{
                    width: 60,
                    height: 60,
                    objectFit: 'contain'
                  }}
                />
              )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PhotoUpload({
  initialImage = '',
  initialMedia = [],
  disabled = false,
  onBusy = () => {}
}) {
  const [media, setMedia] = useState(() =>
    initialMedia.length
      ? initialMedia
      : initialImage
        ? [{ type: 'image', url: initialImage }]
        : []
  );

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');

  const cover =
    media.find(entry => entry.type === 'image')?.url || '';

  const limit = 12;

  async function choose(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) return;

    if (media.length + files.length > limit) {
      setError('Add up to 12 photos/videos per product.');
      return;
    }

    setUploading(true);
    onBusy(true);
    setError('');

    let completed = 0;

    try {
      for (const file of files) {
        const video =
          ['video/mp4', 'video/webm'].includes(file.type);

        if (
          !video &&
          !['image/jpeg', 'image/png', 'image/webp']
            .includes(file.type)
        ) {
          throw Error(
            file.name + ': choose JPG, PNG, WebP, MP4 or WebM.'
          );
        }

        if (file.size > 20 * 1024 * 1024) {
          throw Error(file.name + ': maximum 20 MB.');
        }

        setMessage(
          'Preparing ' + (completed + 1) +
          ' of ' + files.length + '…'
        );

        const blob = video ? file : await resizePhoto(file);

        setMessage(
          'Uploading ' + (completed + 1) +
          ' of ' + files.length + '…'
        );

        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'content-type': video ? file.type : 'image/jpeg'
          },
          body: blob
        });

        let data;

        try {
          data = await response.json();
        } catch {
          throw Error('Sign in again and retry the upload.');
        }

        if (!response.ok) {
          throw Error(data.error || 'Upload failed.');
        }

        const url = data.url || data.image;

        if (!url) {
          throw Error('No media link was returned.');
        }

        setMedia(previous => [
          ...previous,
          {
            type: data.type || (video ? 'video' : 'image'),
            url,
            publicId: data.publicId || ''
          }
        ]);

        completed++;
      }

      setMessage(
        completed +
        ' files ready. Save the product to attach them.'
      );
    } catch (problem) {
      setError(problem.message);
      setMessage(
        completed +
        ' files uploaded. Successful uploads remain below; ' +
        'save to attach them.'
      );
    } finally {
      setUploading(false);
      onBusy(false);
    }
  }

  function move(index, direction) {
    setMedia(previous => {
      const next = [...previous];
      const target = index + direction;

      if (target < 0 || target >= next.length) {
        return previous;
      }

      [next[index], next[target]] =
        [next[target], next[index]];

      return next;
    });
  }

  function addLink() {
    const value = link.trim();
    const local = /^\/(?!\/)[^\s\\?#]+$/.test(value);
    let valid = local;

    try {
      const url = new URL(value);
      valid =
        url.protocol === 'https:' &&
        !url.username &&
        !url.password;
    } catch {}

    if (!valid) {
      setError(
        'Enter an HTTPS photo link or a local /assets/ path.'
      );
      return;
    }

    if (media.length >= limit) {
      setError('Maximum 12 files per product.');
      return;
    }

    setMedia(previous => [
      ...previous,
      { type: 'image', url: value }
    ]);

    setLink('');
    setError('');
  }

  return (
    <div className="field wide">
      <span>
        Product photos and videos ({media.length}/{limit})
      </span>

      <input type="hidden" name="image" value={cover} />

      <input
        type="hidden"
        name="media"
        value={JSON.stringify(media)}
      />

      <input
        aria-label="Choose product photos and videos"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        disabled={disabled || uploading}
        onChange={choose}
      />

      <small>
        Select several files together. Photos resize
        automatically; videos upload as selected.
        Maximum 20 MB per original file.
      </small>

      <small>
        The first photo is the cover.
        Move a photo earlier to change it.
      </small>

      <div style={{
        display: 'grid',
        gridTemplateColumns:
          'repeat(auto-fit,minmax(140px,1fr))',
        gap: 12
      }}>
        {media.map((entry, index) => (
          <div
            key={entry.url + index}
            style={{
              border: '1px solid #ddd',
              padding: 8,
              borderRadius: 8
            }}
          >
            {entry.type === 'video' ? (
              <video
                src={entry.url}
                controls
                playsInline
                preload="metadata"
                style={{ width: '100%', height: 120 }}
              />
            ) : (
              <img
                src={photoUrl(entry.url, 300)}
                alt={'Photo ' + (index + 1)}
                style={{
                  width: '100%',
                  height: 120,
                  objectFit: 'contain'
                }}
              />
            )}

            <small>
              {entry.type === 'image' && entry.url === cover
                ? 'Cover photo'
                : entry.type === 'video'
                  ? 'Video'
                  : 'Photo'}
            </small>

            <div className="card-actions">
              <button
                type="button"
                disabled={
                  disabled || uploading || index === 0
                }
                onClick={() => move(index, -1)}
              >
                Earlier
              </button>

              <button
                type="button"
                disabled={
                  disabled ||
                  uploading ||
                  index === media.length - 1
                }
                onClick={() => move(index, 1)}
              >
                Later
              </button>

              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() =>
                  setMedia(previous =>
                    previous.filter((_, i) => i !== index)
                  )
                }
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <small>
        Remove detaches media when you save;
        it does not delete the Cloudinary file.
      </small>

      <details>
        <summary>Or add an existing photo link</summary>

        <input
          aria-label="Existing photo link"
          type="text"
          value={link}
          disabled={disabled || uploading}
          placeholder="https://… or /assets/cloudvibes/photo.jpg"
          onChange={event => setLink(event.target.value)}
        />

        <button
          type="button"
          disabled={disabled || uploading}
          onClick={addLink}
        >
          Add photo link
        </button>
      </details>

      {message && <small role="status">{message}</small>}

      {error && (
        <small role="alert" style={{ color: '#a52222' }}>
          {error}
        </small>
      )}
    </div>
  );
}
