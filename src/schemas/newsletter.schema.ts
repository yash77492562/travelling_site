import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
    timestamps: true
})
export class Newsletter {
    @Prop({ required: true, unique: true })
    email: string;

    @Prop()
    name?: string;

    @Prop()
    phone?: string;

    @Prop({ type: Boolean, default: true })
    is_active: boolean;

    @Prop({ type: Boolean, default: false })
    is_synced_with_zoho: boolean;

    @Prop()
    zoho_contact_id?: string;

    @Prop({ type: Date, default: Date.now })
    subscribed_at: Date;

    @Prop({ type: Date })
    unsubscribed_at?: Date;

    @Prop()
    unsubscribe_reason?: string;

    @Prop()
    source?: string; // 'website', 'admin', 'import', etc.

    @Prop([String])
    interests?: string[]; // Tour categories they're interested in

    @Prop()
    last_email_sent?: Date;

    @Prop({ default: 0 })
    email_open_count: number;

    @Prop({ default: 0 })
    email_click_count: number;

    @Prop({ type: Boolean, default: false })
    is_deleted: boolean;

    @Prop({ type: Date })
    is_deleted_date?: Date;
}

export const NewsletterSchema = SchemaFactory.createForClass(Newsletter);