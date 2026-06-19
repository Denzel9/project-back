import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.getOrThrow<string>('AWS_REGION');
    const endpoint = this.configService.getOrThrow<string>('AWS_ENDPOINT');

    this.bucket = this.configService.getOrThrow<string>('AWS_BUCKET_NAME');
    this.publicBaseUrl =
      this.configService.get<string>('AWS_PUBLIC_BASE_URL') ??
      `${endpoint.replace(/\/$/, '')}/${this.bucket}`;

    this.client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY'
        ),
      },
      forcePathStyle: true,
    });
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
}
