import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

@Schema({
    timestamps: true
})
export class AdminLogs {
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
    admin_id: mongoose.Types.ObjectId;

    @Prop({ required: true })
    action: string; // "CREATE_TOUR", "UPDATE_BOOKING", "DELETE_USER", "LOGIN", etc.

    @Prop({ required: true })
    entity_type: string; // "tour", "booking", "user", "system"

    @Prop()
    entity_id: string; // ID of the affected entity

    @Prop({ required: true })
    description: string;

    @Prop()
    ip_address: string;

    @Prop()
    user_agent: string;

    @Prop({ type: mongoose.Schema.Types.Mixed })
    old_values: any; // Store previous values for updates

    @Prop({ type: mongoose.Schema.Types.Mixed })
    new_values: any; // Store new values for updates

    @Prop({ enum: ['info', 'warning', 'error', 'critical'], default: 'info' })
    severity: string;

    @Prop()
    module: string; // Which module/controller performed the action

    @Prop({ type: Boolean, default: false })
    is_system_generated: boolean; // Auto-generated vs manual admin action
}

export const AdminLogsSchema = SchemaFactory.createForClass(AdminLogs);