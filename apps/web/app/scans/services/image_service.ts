import sharp from 'sharp'

export default class ImageService {
  async compress(buffer: Buffer) {
    return sharp(buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
  }
}
