export async function onRequestPost({ request, env }) {
  const fail = (error, status = 400) =>
    Response.json({ error }, { status });

  const cloud = env.CLOUDINARY_CLOUD_NAME;
  const key = env.CLOUDINARY_API_KEY;
  const secret = env.CLOUDINARY_API_SECRET;

  if (!cloud || !key || !secret) {
    return fail(
      'Configure the three Cloudinary variables in Cloudflare.',
      503
    );
  }

  if (!/^[a-z0-9_-]+$/i.test(cloud)) {
    return fail('Invalid Cloudinary cloud name.', 503);
  }

  const limit = 10 * 1024 * 1024;

  if (Number(request.headers.get('content-length')) > limit) {
    return fail('Choose a photo smaller than 10 MB.', 413);
  }

  const reader = request.body?.getReader();
  if (!reader) return fail('Choose a photo first.');

  const chunks = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    size += value.length;

    if (size > limit) {
      await reader.cancel();
      return fail('Choose a photo smaller than 10 MB.', 413);
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  let type = '';
  let ext = '';

  if (
    size >= 12 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  ) {
    type = 'image/jpeg';
    ext = 'jpg';
  } else if (
    size >= 12 &&
    bytes.slice(0, 8).join(',') ===
      '137,80,78,71,13,10,26,10'
  ) {
    type = 'image/png';
    ext = 'png';
  } else if (
    size >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  ) {
    type = 'image/webp';
    ext = 'webp';
  } else {
    return fail('Choose a JPG, PNG or WebP photo.');
  }

  const publicId = 'cloudvibes/' + crypto.randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signed =
    `public_id=${publicId}&timestamp=${timestamp}${secret}`;

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(signed)
  );

  const signature = Array.from(
    new Uint8Array(digest),
    b => b.toString(16).padStart(2, '0')
  ).join('');

  const form = new FormData();
  form.append(
    'file',
    new Blob([bytes], { type }),
    'photo.' + ext
  );
  form.append('public_id', publicId);
  form.append('timestamp', timestamp);
  form.append('api_key', key);
  form.append('signature', signature);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
      {
        method: 'POST',
        body: form
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return fail(
        'Cloudinary rejected the upload. Check credentials and available credits.',
        502
      );
    }

    const url = new URL(result.secure_url);

    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'res.cloudinary.com'
    ) {
      return fail('Unexpected media response.', 502);
    }

    return Response.json({
      image: url.href,
      publicId: result.public_id
    });
  } catch {
    return fail('Photo upload failed. Please try again.', 502);
  }
}
