// config.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Config extends Document {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ type: Object })
  value: any;

  @Prop()
  expires_at?: Date;

  @Prop()
  created_at?: Date;
  @Prop()
  updated_at?: Date;
}

export const ConfigSchema = SchemaFactory.createForClass(Config);