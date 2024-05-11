import * as mongoose from 'mongoose';
// History Collection Schema
const historySchema = new mongoose.Schema({

    address: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['Paid', 'Not paid'], default: 'Not paid' }
});


export type History = mongoose.InferSchemaType<typeof historySchema>;
export const History = mongoose.model('History', historySchema);