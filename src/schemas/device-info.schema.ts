import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class DeviceInfo extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ required: false })
  deviceId?: string;

  @Prop({ required: false })
  deviceType?: string;

  @Prop({ required: false })
  browserName?: string;

  @Prop({ required: false })
  browserVersion?: string;

  @Prop({ required: false })
  osName?: string;

  @Prop({ required: false })
  osVersion?: string;

  @Prop({ required: false })
  ipAddress?: string;

  @Prop({ required: false })
  userAgent?: string;

  @Prop({
    type: {
      country: { type: String, required: false },
      city: { type: String, required: false },
      region: { type: String, required: false }
    },
    required: false
  })
  location?: {
    country?: string;
    city?: string;
    region?: string;
  };

  @Prop({ required: true })
  refreshToken: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, default: Date.now })
  lastUsedAt: Date;
}

export const DeviceInfoSchema = SchemaFactory.createForClass(DeviceInfo);