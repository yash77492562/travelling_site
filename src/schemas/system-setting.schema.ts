
// schemas/system-settings.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SystemSettings extends Document {
  @Prop({ required: true, default: 'Packers Haven' })
  site_name: string;

  @Prop({ required: true, default: 'Your adventure awaits' })
  site_description: string;

  @Prop({ required: true })
  contact_email: string;

  @Prop()
  support_phone: string;

  @Prop({ default: true })
  razorpay_enabled: boolean;

  @Prop({ default: true })
  email_notifications: boolean;

  @Prop({ default: false })
  maintenance_mode: boolean;

  @Prop({ default: true })
  user_registration_enabled: boolean;

  @Prop({ default: 10 })
  max_booking_per_user: number;

  @Prop({ default: 2 })
  default_user_role: number;

  @Prop({ default: 24 })
  session_timeout: number; // in hours

  @Prop({ default: 6 })
  password_min_length: number;

  @Prop({ default: true })
  enable_email_verification: boolean;

  @Prop({ default: false })
  enable_two_factor_auth: boolean;

  @Prop({ type: Object })
  seo_settings: {
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string;
    og_image?: string;
  };

  @Prop({ type: Object })
  razorpay_config: {
    key_id?: string;
    key_secret?: string;
    webhook_secret?: string;
  };

  @Prop({ type: Object })
  email_config: {
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_pass?: string;
    from_email?: string;
    from_name?: string;
  };
}

export const SystemSettingsSchema = SchemaFactory.createForClass(SystemSettings);

