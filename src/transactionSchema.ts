import * as mongoose from 'mongoose';
// transaction Collection Schema
const transactionSchema = new mongoose.Schema({
    transactionHash: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    amount: { type: Number, required: true }
});


export type Transaction = mongoose.InferSchemaType<typeof transactionSchema>;
export const Transaction = mongoose.model('transaction', transactionSchema);