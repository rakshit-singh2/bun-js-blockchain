import { Hono } from 'hono';
import { ethers, JsonRpcProvider, TransactionReceipt, Interface, formatEther, parseEther, Contract, Wallet } from 'ethers';
import { Resend } from 'resend';
import * as mongoose from 'mongoose';

const app = new Hono();
const resend = new Resend(process.env.RESEND_KEY);

mongoose.connect('mongodb://localhost:27017/mydatabase');
import { Transaction } from './transactionSchema';
import { History } from './historySchema';

const provider = new JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);
const iface = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
]);
const USDTAddress = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';
const abi = [
  "function transfer(address recipient, uint256 amount) external returns (bool)"
];
const privateKey = process.env.PRIVATE_KEY!;
const wallet = new Wallet(privateKey, provider);

app.get('/', (c) => c.text('Hello Hono!'));

provider.on('block', async (blockNumber) => {
  try {
    console.log("Block Number: ", blockNumber);
    const block = await provider.getBlock(blockNumber);
    if (block && block.transactions) {
      for (const txHash of block.transactions) {
        try {
          const receipt = await provider.getTransactionReceipt(txHash);
          if (receipt.to === USDTAddress && receipt.logs) {
            for (const log of receipt.logs) {
              try {
                const parsedLog = iface.parseLog(log);
                if (parsedLog && parsedLog.name === 'Transfer') {
                  const { data, error } = await resend.emails.send({
                    from: 'onboarding@resend.dev',
                    to: 'a2fsharma@gmail.com',
                    subject: 'New Transaction',
                    html: `<p>Transaction Done. Below are details.\n<strong>Transaction Details:</strong> ${parsedLog.args[2]}</p>`
                  });
                  if (error) {
                    console.log(error);
                  } else {
                    console.log(data);
                  }
                  const existingTransaction = await Transaction.findOne({ transactionHash: txHash });
                  if (existingTransaction) {
                    continue;
                  }
                  const from = parsedLog.args[0];
                  const to = parsedLog.args[1];
                  const valueInEther = formatEther(parsedLog.args[2]);
                  await Transaction.create({
                    transactionHash: txHash,
                    from,
                    to,
                    amount: valueInEther
                  });
                  const existingHistory = await History.findOne({ address: from });
                  if (existingHistory) {
                    existingHistory.totalAmount += parseFloat(valueInEther);
                    await existingHistory.save();
                  } else {
                    await History.create({
                      address: from,
                      totalAmount: parseFloat(valueInEther)
                    });
                  }
                }
              } catch (parseError) {
                console.error('Error parsing log:', parseError);
              }
            }
          }
        } catch (receiptError) {
          console.error('Error processing transaction:', receiptError);
        }
      }
    }
  } catch (error) {
    console.error('Error processing block:', error);
  }
});

app.get('/getUsdtTransferHistory/:address', async (c) => {
  try {
    const address = c.req.param('address');
    console.log(address)
    const existingHistory = await History.find({ address });
    return c.json(existingHistory);
  } catch (error) {
    console.error('Error getting history:', error);
    return c.json({ error: 'Error fetching history' });
  }
});

app.post('/send-link-token', async (c) => {
  try {
    const eligibleHistories = await History.find({ totalAmount: { $gt: 500 } , status:'Not paid'});
    const tokenContract = new Contract("0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5", abi, wallet);
    for (let history of eligibleHistories) {
      try {
        const tx = await tokenContract.transfer(history.address, parseEther('1'));
        await tx.wait();
        history.status='Paid'
        await history.save();
        console.log("Transfer successful to:", history.address);
      } catch (txError) {
        console.error('Error sending token:', txError);
      }
    }
    return c.text('Tokens sent to eligible addresses.');
  } catch (error) {
    console.error('Error processing send-link-token:', error);
    return c.json({ error: 'Failed to send tokens' });
  }
});

Bun.serve({
  fetch: app.fetch,
  port: 3000,
  development: true,
});

console.log('Server is running on http://localhost:3000');
