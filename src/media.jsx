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
      1,
      Math.round(photo.naturalWidth * scale)
    );
    canvas.height = Math.max(
      1,
      Math.round(photo.naturalHeight * scale)
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

export default function PhotoUpload({
  initialImage = '',
  disabled = false,
  onBusy = () => {}
}) {
  const [image, setImage] = useState(initialImage);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    onBusy(true);
    setError('');
    setMessage('Resizing photo…');

    try {
      const blob = await resizePhoto(file);
      setMessage('Uploading photo…');

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'image/jpeg' },
        body: blob
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw Error('Sign in again and retry the upload.');
      }

      if (!response.ok) {
        throw Error(data.error || 'Photo upload failed.');
      }

      if (!data.image) {
        throw Error('No photo link was returned.');
      }

      setImage(data.image);
      setMessage(
        `Photo ready (${Math.ceil(blob.size / 1024)} KB). ` +
        'Save the product to attach it.'
      );
    } catch (problem) {
      setError(problem.message);
      setMessage('');
    } finally {
      setUploading(false);
      onBusy(false);
    }
  }

  return (
    <div className="field">
      <span>Product photo</span>

      <input type="hidden" name="image" value={image} />

      <input
        aria-label="Choose product photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || uploading}
        onChange={choose}
      />

      <small>
        Automatically resized to a maximum of 1600 pixels
        without stretching.
      </small>

      {image && (
        <>
          <img
            src={photoUrl(image, 400)}
            alt="Product photo preview"
            style={{
              width: '100%',
              height: 180,
              objectFit: 'contain',
              borderRadius: 8
            }}
          />

          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => {
              setImage('');
              setMessage(
                'Save the product to remove its photo.'
              );
            }}
          >
            Remove photo
          </button>
        </>
      )}

      <details>
        <summary>Or use an existing photo link</summary>
        <input
          aria-label="Existing photo link"
          type="text"
          value={image}
          disabled={disabled || uploading}
          placeholder="https://… or /assets/cloudvibes/photo.jpg"
          onChange={event => {
            setImage(event.target.value.trim());
            setMessage('');
          }}
        />
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
