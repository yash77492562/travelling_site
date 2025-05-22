import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true, // This will add createdAt and updatedAt fields
  versionKey: false, // This will remove the __v field
})
export class User extends Document {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 150 })
  email: string;

  @Prop({ required: true, minlength: 6, maxlength: 100 })
  password?: string;

  @Prop({ min: 1, max: 9999 })
  phone_code?: number;

  @Prop({ min: 1000000000, max: 99999999999 })
  phone_number?: number;

  @Prop({ maxlength: 10 })
  country_code?: string;

  @Prop({ default: true })
  status: boolean;

  @Prop({ default: 2, min: 0 }) // 0 = Super Admin, 1 = Admin, 2 = User, etc.
  role: number;

  @Prop({ default: false })
  is_deleted: boolean;

  @Prop()
  is_deleted_date?: Date;

  // Additional fields for authentication
  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop()
  emailVerificationToken?: string;

  @Prop()
  refreshToken?: string;

  @Prop()
  passwordResetToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  @Prop()
  lastLoginAt?: Date;

  // Additional profile fields
  @Prop({ trim: true, maxlength: 50 })
  name?: string;

  @Prop({ trim: true, maxlength: 25 })
  firstName?: string;

  @Prop({ trim: true, maxlength: 25 })
  lastName?: string;

  @Prop()
  dateOfBirth?: string;

  @Prop()
  gender?: string;

  @Prop({ maxlength: 255 })
  address?: string;

  @Prop({ maxlength: 50 })
  city?: string;

  @Prop({ maxlength: 50 })
  state?: string;

  @Prop({ maxlength: 50 })
  country?: string;

  @Prop({ maxlength: 10 })
  postalCode?: string;

  @Prop()
  phone?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);