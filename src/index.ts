import TelegramBot from 'node-telegram-bot-api';
import { Twilio } from "twilio";

import express from 'express';
import * as bodyParser from 'body-parser';

import axios from 'axios';

const sendMessage = async (chatId: string, content: string) => {
    try {
        const response = await axios.post('/client/sendMessage/demox', {
            chatId,
            contentType: 'string',
            content
        }, { headers: { 'Content-Type': 'application/json' }});

        return response.data;
    } catch (error) {
        console.error(error);
        return null;
    }
}

// function to send SMS
async function sendSms(body: string, to: string, from: string) {
    const accountSid = "";
    const authToken = "";
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    const myNumber = process.env.MY_NUMBER;
    const client = new Twilio(accountSid, authToken);

    try {
        const message = await client.messages.create({
            body: body,
            to: to,  // Text this number
            from: from // From a valid Twilio number
        });

        console.log(message.sid);
    } catch (error) {
        console.error(error);
    }
}

// replace the value below with the Telegram token you receive from @BotFather
const token = '';
const bot = new TelegramBot(token, {polling: true});

bot.onText(/\/send-whatsapp (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    let input = ""
    // 'match' is an array whose first element is the text that matches the
    // regular expression, the second element is the capture group
    if (match) {
        input = match[1];
    }

    sendMessage("", input)

    //sendSms('Hello from my Twilio bot!', '+12345678901', '+10987654321');

    bot.sendMessage(chatId, `Sent`);
});

bot.onText(/\/send-sms (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    let input = ""
    // 'match' is an array whose first element is the text that matches the
    // regular expression, the second element is the capture group
    if (match) {
        input = match[1];
    }

    //sendMessage("5215585491123@c.us", input)

    sendSms('!', '', '');

    bot.sendMessage(chatId, `Sent`);
});

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/sms', (req, res) => {
    const twilioSignature = req.headers['x-twilio-signature'];
    const body = req.body.Body;
    const from = req.body.From;

    console.log(`Received a message from ${from}: ${body}`);

    res.setHeader('Content-Type', 'text/xml');
    res.send(`
        <Response>
            <Message>Message received. Thank you!</Message>
        </Response>
    `);
});

app.listen(3005, () => {
    console.log('Server is running on port 3005');
});

async function callChatGPT(text: string) {
    const url = "https://api.openai.com/v1/engines/davinci-codex/completions";
    const headers = {
        Authorization: `Bearer `,
        "Content-Type": "application/json"
    };

    const data = {
        prompt: text,
        max_tokens: 60,
        temperature: 0.6
    };

    try {
        const response = await axios.post(url, data, { headers });
        return response.data.choices[0].text.trim();
    } catch (error) {
        console.error(error);
    }
}


import { config } from "dotenv";
import { IBundler, Bundler } from "@biconomy/bundler";
import {
    BiconomySmartAccount,
    BiconomySmartAccountConfig,
    DEFAULT_ENTRYPOINT_ADDRESS,
} from "@biconomy/account";
import { Wallet, providers, ethers } from "ethers";
import { ChainId } from "@biconomy/core-types";
import {
    BiconomyPaymaster,
    IHybridPaymaster,
    PaymasterFeeQuote,
    PaymasterMode,
    SponsorUserOperationDto
} from "@biconomy/paymaster";
const { ERC20ABI } = require('./abi')
const { CONTRACTABI } = require('./contractabi')

config();


const bundler: IBundler = new Bundler({
    bundlerUrl:
        "https://bundler.biconomy.io/api/v2/5/",
    chainId: ChainId.GOERLI,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
});

const provider = new providers.JsonRpcProvider(
    "https://rpc.ankr.com/eth_goerli"
);


const wallet = new Wallet( "", provider);

const paymaster = new BiconomyPaymaster({
    paymasterUrl: "https://paymaster.biconomy.io/api/v1/5/"
});

const biconomySmartAccountConfig: BiconomySmartAccountConfig = {
    signer: wallet,
    paymaster: paymaster,
    chainId: ChainId.GOERLI,
    bundler: bundler,


    //defaultValidationModule: module,
    //activeValidationModule: module
};

async function createAccount() {
    console.log("a")
    let biconomySmartAccount = new BiconomySmartAccount(
        biconomySmartAccountConfig
    );
    console.log("b")

    biconomySmartAccount = await biconomySmartAccount.init();
    console.log("owner: ", biconomySmartAccount.owner);
    console.log("address: ", await biconomySmartAccount.getSmartAccountAddress());
    return biconomySmartAccount;
}

async function send(amount : number) {
    try {
        console.log("1")
        let tokenAddress = '0xcbE9771eD31e761b744D3cB9eF78A1f32DD99211'
        const biconomySmartAccount = await createAccount();
        console.log("2")

        //const readProvider = new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/arbitrum")
        const readProvider = new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/eth_goerli")
        const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, readProvider)
        let decimals = 18

        try {
            decimals = await tokenContract.decimals()
        } catch (error) {
            throw new Error('invalid token address supplied')
        }


        console.log("3")
        const amountGwei = ethers.utils.parseUnits(amount.toString(), decimals)
        const data = (await tokenContract.populateTransaction.transfer(tokenAddress, amountGwei)).data
        const transaction = {
            to: "",
            data,
        };

        console.log("4")

        // build partial userOp
        let partialUserOp = await biconomySmartAccount.buildUserOp([transaction]);
        console.log("4.55")

        let finalUserOp = partialUserOp;

        console.log("5")

        const biconomyPaymaster = biconomySmartAccount.paymaster as IHybridPaymaster<SponsorUserOperationDto>;
        let paymasterServiceData: SponsorUserOperationDto = {
            mode: PaymasterMode.SPONSORED,
            //feeTokenAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
            /*            smartAccountInfo: {
                            name: 'Demo PROD',
                            version: '1.1.0'
                        },*/
        };

        console.log("6")

        try{
            const paymasterAndDataWithLimits =
                await biconomyPaymaster.getPaymasterAndData(
                    finalUserOp,
                    paymasterServiceData
                );
            finalUserOp.paymasterAndData = paymasterAndDataWithLimits.paymasterAndData;

            console.log("yepx")

            // below code is only needed if you sent the glaf calculateGasLimits = true
            if (
                paymasterAndDataWithLimits.callGasLimit &&
                paymasterAndDataWithLimits.verificationGasLimit &&
                paymasterAndDataWithLimits.preVerificationGas
            ) {

                // Returned gas limits must be replaced in your op as you update paymasterAndData.
                // Because these are the limits paymaster service signed on to generate paymasterAndData
                // If you receive AA34 error check here..

                finalUserOp.callGasLimit = paymasterAndDataWithLimits.callGasLimit;
                finalUserOp.verificationGasLimit =
                    paymasterAndDataWithLimits.verificationGasLimit;
                finalUserOp.preVerificationGas =
                    paymasterAndDataWithLimits.preVerificationGas;
            }
        } catch (e) {
            console.log("error received ", e);
        }

        //5

        console.log(`userOp: ${JSON.stringify(finalUserOp, null, "\t")}`);

        // Below function gets the signature from the user (signer provided in Biconomy Smart Account)
        // and also send the full op to attached bundler instance

        try {
            const userOpResponse = await biconomySmartAccount.sendUserOp(finalUserOp);
            console.log(`userOp Hash: ${userOpResponse.userOpHash}`);
            const transactionDetails = await userOpResponse.wait();
            console.log(
                `transactionDetails: ${JSON.stringify(transactionDetails, null, "\t")}`
            );
            //SendMessage("Thanks, this is the transaction: https://goerli.etherscan.io/tx/" + transactionDetails.receipt.transactionHash, "+525586169210")
        } catch (e) {
            console.log("error received ", e);
        }

    } catch (e) {
        console.log("el errorx", e)
    }

}


