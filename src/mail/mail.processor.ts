import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MAIL_QUEUE, MAIL_SEND_JOB } from './mail.constants';
import { MailService } from './mail.service';
import type { SendEmailJobPayload } from './mail.types';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<SendEmailJobPayload>): Promise<void> {
    if (job.name !== MAIL_SEND_JOB) {
      this.logger.warn(`Unknown mail job name: ${job.name}`);
      return;
    }

    await this.mailService.deliverMail(job.data);
  }
}
