import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service.js';
import type { UpdateSettingsDto } from './settings.dto.js';

type SettingsData = Omit<UpdateSettingsDto, 'revision'>;
interface SettingsRow {
  data: Partial<SettingsData>;
  revision: number;
  updated_at: Date;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService
  ) {}

  async get() {
    const { rows } = await this.database.query<SettingsRow>(
      'SELECT data,revision,updated_at FROM store_settings WHERE id=1'
    );
    const row = rows[0];
    if (!row) throw new Error('Store settings migration required');
    return {
      phone: '',
      whatsapp: '',
      contactEmail: '',
      address: '',
      openingHours: '',
      deliveryMillimes: this.config.get<number>('DELIVERY_FEE_MILLIMES', 8000),
      deliveryEstimate: '',
      notificationEmail: '',
      ...row.data,
      revision: row.revision,
      updatedAt: row.updated_at
    };
  }

  async publicSettings() {
    const value = await this.get();
    // Explicit allowlist: never expose internal notification recipients or audit information.
    return {
      phone: value.phone,
      whatsapp: value.whatsapp,
      contactEmail: value.contactEmail,
      address: value.address,
      openingHours: value.openingHours,
      deliveryMillimes: value.deliveryMillimes,
      deliveryEstimate: value.deliveryEstimate
    };
  }

  async update(input: UpdateSettingsDto, actorId: string) {
    const { revision, ...data } = input;
    return this.database.transaction(async (client) => {
      const result = await client.query<SettingsRow>(
        'UPDATE store_settings SET data=$1::jsonb,revision=revision+1,updated_at=now(),updated_by=$2 WHERE id=1 AND revision=$3 RETURNING data,revision,updated_at',
        [JSON.stringify(data), actorId, revision]
      );
      const row = result.rows[0];
      if (!row)
        throw new ConflictException(
          'Les paramètres ont été modifiés ailleurs. Rechargez la page avant de réessayer.'
        );
      await client.query(
        "INSERT INTO audit_logs(actor_user_id,action,entity_type,metadata) VALUES ($1,'settings.updated','store_settings',jsonb_build_object('revision',$2::integer))",
        [actorId, row.revision]
      );
      return { ...data, revision: row.revision, updatedAt: row.updated_at };
    });
  }
}
