export {
    getStorage,
    httpGet,
    httpPost,
    httpGetImage,
    setStorage,
    removeStorage,
    clearStorage,
    notification,
    setLocalStorage,
    removeLocalStorage,
    clearLocalStorage,
    getLocalStorage
} from '../common';
import {
    getStorage,
    setStorage,
    notification,
    httpPost,
    httpPostPromise,
    setLocalStorage,
    getLocalStorage,
    getAssetSymbol,
    getAssetDecimal
} from '../common';
import { ChainType, WitnessScope, DEFAULT_N2_RPC_NETWORK, DEFAULT_N3_RPC_NETWORK, RpcNetwork, NEO, GAS, NEO3, GAS3 } from '../common/constants';
import {
    requestTarget, GetBalanceArgs, ERRORS,
    EVENT, AccountPublicKey, GetBlockInputArgs,
    TransactionInputArgs, GetStorageArgs, VerifyMessageArgs,
    SendArgs
} from '../common/data_module_neo2';
import {
    N3ApplicationLogArgs, N3GetBlockInputArgs,
    N3GetStorageArgs, N3InvokeArgs, N3InvokeMultipleArgs,
    N3InvokeReadArgs, N3SendArgs , N3TransactionArgs,
    N3VerifyMessageArgs, requestTargetN3, N3BalanceArgs
} from '../common/data_module_neo3';
import { base64Encode, getPrivateKeyFromWIF, getPublicKeyFromPrivateKey, getScriptHashFromAddress, getWalletType, hexstring2str, str2hexstring } from '../common/utils';
import {
    u as u3,
    wallet as wallet3
} from '@cityofzion/neon-core-neo3/lib';
import { wallet as wallet2 } from '@cityofzion/neon-js';
import BigNumber from 'bignumber.js';

/**
 * Background methods support.
 * Call window.NeoLineBackground to use.
 */
declare var chrome;

let currLang = 'en';
let currN2Network: RpcNetwork = DEFAULT_N2_RPC_NETWORK[0];
let currN3Network: RpcNetwork = DEFAULT_N3_RPC_NETWORK[0];
let currChainId = 1;
let tabCurr: any;
let currChain = 'Neo2';
export let password = null;

export let haveBackupTip: boolean = null;

export const version = chrome.runtime.getManifest().version;

export function expand() {
    window.open('index.html#asset', '_blank');
}
(function init() {
    setInterval(async () => {
        let chainType = await getLocalStorage('chainType', () => { });
        const n3Networks = await getLocalStorage('n3Networks', () => { });
        const n2Networks = await getLocalStorage('n2Networks', () => { });
        const n3SelectedNetworkIndex = await getLocalStorage('n3SelectedNetworkIndex', () => { });
        const n2SelectedNetworkIndex = await getLocalStorage('n2SelectedNetworkIndex', () => { });
        if (n2Networks && n2SelectedNetworkIndex !== undefined) {
            currN2Network = n2Networks[n2SelectedNetworkIndex];
        }
        if (n3Networks && n3SelectedNetworkIndex !== undefined) {
            currN3Network = n3Networks[n3SelectedNetworkIndex];
        }
        if (!chainType) {
            chainType = await getWalletType();
        };
        currChain = chainType;
        let rpcUrl;
        let network;
        if (chainType === ChainType.Neo2) {
            network = n2Networks[n2SelectedNetworkIndex].network;
            rpcUrl = n2Networks[n2SelectedNetworkIndex].rpcUrl;
        } else if (chainType === ChainType.Neo3) {
            network = n3Networks[n3SelectedNetworkIndex].network;
            rpcUrl = n3Networks[n3SelectedNetworkIndex].rpcUrl;
        }
        setTimeout(async () => {
            let oldHeight = await getLocalStorage(`${chainType}_${network}BlockHeight`, () => { }) || 0;
            httpPost(rpcUrl, {
                jsonrpc: '2.0',
                method: 'getblockcount',
                params: [],
                id: 1
            }, async (blockHeightData) => {
                const newHeight = blockHeightData.result;
                if (oldHeight === 0 || newHeight - oldHeight > 5) {
                    oldHeight = newHeight - 1;
                }
                let timer;
                for (let reqHeight = oldHeight; reqHeight < newHeight; reqHeight++) {
                    if (oldHeight !== newHeight) {
                        timer = setTimeout(() => {
                            httpPost(rpcUrl, {
                                jsonrpc: '2.0',
                                method: 'getblock',
                                params: [reqHeight, 1],
                                id: 1
                            }, (blockDetail) => {
                                if (blockDetail.error === undefined) {
                                    const txStrArr = [];
                                    blockDetail.result.tx.forEach(item => {
                                        txStrArr.push(item.txid || item.hash);
                                    });
                                    windowCallback({
                                        data: {
                                            chainId: currChainId,
                                            blockHeight: reqHeight,
                                            blockTime: blockDetail.result.time,
                                            blockHash: blockDetail.result.hash,
                                            tx: txStrArr,
                                        },
                                        return: EVENT.BLOCK_HEIGHT_CHANGED
                                    });
                                }
                                if (newHeight - reqHeight <= 1) {
                                    const setData = {};
                                    setData[`${chainType}_${network}BlockHeight`] = newHeight;
                                    setLocalStorage(setData);
                                    clearTimeout(timer);
                                }
                            }, '*');
                        });
                    }
                }
            }, '*')
        }, 0);
        if(chainType === ChainType.Neo2) {
            const txArr = await getLocalStorage(`${currN2Network.network}TxArr`, () => { }) || [];
            if (txArr.length === 0) {
                return;
            }
            let tempTxArr = [...txArr];
            txArr.forEach(txid => {
                const data = {
                    jsonrpc: '2.0',
                    method: 'getrawtransaction',
                    params: [txid, 1],
                    id: 1,
                };
                httpPost(currN2Network.rpcUrl, data, (res) => {
                    if (res?.result?.blocktime) {
                        windowCallback({
                            data: {
                                chainId: currChainId,
                                txid,
                                blockHeight: res?.result?.blockindex,
                                blockTime: res?.result?.blocktime,
                            },
                            return: EVENT.TRANSACTION_CONFIRMED
                        });
                        const setData = {};
                        tempTxArr = tempTxArr.filter(item => item !== txid);
                        setData[`${currN2Network.network}TxArr`] = tempTxArr;
                        setLocalStorage(setData);
                    }
                })
            })
        } else if(chainType === ChainType.Neo3) {
            const txArr = await getLocalStorage(`${currN3Network.network}TxArr`, () => { }) || [];
            if (txArr.length === 0) {
                return;
            }
            let tempTxArr = [...txArr];
            txArr.forEach(txid => {
                const data = {
                    jsonrpc: '2.0',
                    method: 'getrawtransaction',
                    params: [txid, true],
                    id: 1,
                };
                httpPost(currN3Network.rpcUrl, data, (res) => {
                    if (res?.result?.blocktime) {
                        windowCallback({
                            data: {
                                chainId: currChainId,
                                txid,
                                blockHeight: res?.result?.blockindex,
                                blockTime: res?.result?.blocktime,
                            },
                            return: EVENT.TRANSACTION_CONFIRMED
                        });
                        const setData = {};
                        tempTxArr = tempTxArr.filter(item => item !== txid);
                        setData[`${currN3Network.network}TxArr`] = tempTxArr;
                        setLocalStorage(setData);
                    }
                })
            })
        }
    }, 8000);

    if (navigator.language === 'zh-CN') {
        getStorage('lang', res => {
            if (res === undefined) {
                currLang = 'zh_CN';
                setStorage({ lang: currLang });
            }
        });
    }
    chrome.webRequest.onBeforeRequest.addListener(
        (details: any) => {
            if (details.url.indexOf(chrome.runtime.getURL('/index.html') < 0)) {
                return {
                    redirectUrl: details.url.replace(chrome.runtime.getURL(''), chrome.runtime.getURL('/index.html'))
                };
            } else {
                return {
                    redirectUrl: details.url
                };
            }
        }, {
        urls: [
            chrome.runtime.getURL('')
        ],
        types: ['main_frame']
    },
        ['blocking']
    );
})();

export function setPopup(lang) {
    switch (lang) {
        case 'zh_CN':
            currLang = 'zh_CN';
            break;
        case 'en':
            currLang = 'en';
            break;
    }
}

export function setNetwork(chainId, chainType) {
    // currNetwork = network;
    currChainId = chainId;
    currChain = chainType;
}

getLocalStorage('startTime', (time) => {
    if (time === undefined) {
        setLocalStorage({
            startTime: chrome.csi().startE
        });
        setLocalStorage({
            shouldLogin: true
        });
    } else {
        if (time !== chrome.csi().startE) {
            setLocalStorage({
                shouldLogin: true
            });
            setLocalStorage({
                startTime: chrome.csi().startE
            });
        }
    }
});

chrome.windows.onRemoved.addListener(() => {
    chrome.tabs.query({}, (res) => {
        if (res.length === 0) { // All browsers are closed
            setLocalStorage({
                shouldLogin: true
            });
        }
    });
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    switch (request.target) {
        case requestTarget.PickAddress: {
            window.open(`/index.html#popup/notification/pick-address?hostname=${request.parameter.hostname}&chainType=Neo2&messageID=${request.ID}`, '_blank',
                'height=620, width=386, resizable=no, top=0, left=0');
            return true;
        }
        case requestTargetN3.PickAddress: {
            window.open(`/index.html#popup/notification/pick-address?hostname=${request.parameter.hostname}&chainType=Neo3&messageID=${request.ID}`, '_blank',
                'height=620, width=386, resizable=no, top=0, left=0');
            return true;
        }
        case requestTarget.Connect:
        case requestTarget.AuthState:
            {
                getStorage('connectedWebsites', (res: any) => {
                    if ((res !== undefined && res[request.hostname] !== undefined) || request.connect === 'true') {
                        if (res !== undefined && res[request.hostname] !== undefined && res[request.hostname].status === 'false') {
                            notification(chrome.i18n.getMessage('rejected'), chrome.i18n.getMessage('rejectedTip'));
                            windowCallback({
                                return: requestTarget.Connect,
                                data: false
                            });
                            return;
                        }
                        windowCallback({
                            return: requestTarget.Connect,
                            data: true
                        });
                        notification(`${chrome.i18n.getMessage('from')}: ${request.hostname}`, chrome.i18n.getMessage('connectedTip'));
                    } else {
                        window.open(`/index.html#popup/notification/authorization?icon=${request.icon}&hostname=${request.hostname}&title=${request.title}`, '_blank',
                            'height=620, width=386, resizable=no, top=0, left=0');
                    }
                sendResponse('');
                });
                return true;
            }
        case requestTarget.Login: {
            getLocalStorage('shouldLogin', res => {
                if (res === 'false' || res === false) {
                    windowCallback({
                        return: requestTarget.Login,
                        data: true
                    });
                } else {
                    window.open('/index.html#popup/login?notification=true', '_blank',
                        'height=620, width=386, resizable=no, top=0, left=0');
                }
            })
            return true;
        }
        case requestTarget.AccountPublicKey: {
            try {
                const chain = await getLocalStorage(`chainType`, () => { });
                const key = chain === 'Neo2' ? '' : `-${chain}`;
                const walletArr = await getLocalStorage(`walletArr${key}`, () => { });
                const currWallet = await getLocalStorage('wallet', () => { });
                const WIFArr = await getLocalStorage(`WIFArr${key}`, () => { });
                const data: AccountPublicKey = { address: '', publicKey: '' };
                if (currWallet !== undefined && currWallet.accounts[0] !== undefined) {
                    const privateKey = getPrivateKeyFromWIF(WIFArr[walletArr.findIndex(item =>
                        item.accounts[0].address === currWallet.accounts[0].address)]
                    );
                    data.address = currWallet.accounts[0].address;
                    data.publicKey = getPublicKeyFromPrivateKey(privateKey);
                }
                windowCallback({
                    return: requestTarget.AccountPublicKey,
                    data,
                    ID: request.ID
                })
            } catch (error) {
                console.log(error)
                windowCallback({ data: [], ID: request.ID, return: requestTarget.AccountPublicKey, error: { ...ERRORS.DEFAULT, description: error?.message || error } });
            }
            return;
        }

        case requestTarget.Balance: {
            const parameter = request.parameter as GetBalanceArgs;
            let params = [];
            if (parameter.params instanceof Array) {
                params = parameter.params
            } else {
                params.push(parameter.params)
            }
            const nativeBalanceReqs = [];
            const nep5BalanceReqs = [];
            const utxoReqs = [];
            for (const item of params) {
                (item.assets || []).forEach((asset: string, index) => {
                    if (asset.toLowerCase() === 'neo') {
                        item.assets[index] = NEO;
                    }
                    if (asset.toLowerCase() === 'gas') {
                        item.assets[index] = GAS;
                    }
                });
                const nativeData = {
                    jsonrpc: '2.0',
                    method: 'getaccountstate',
                    params: [item.address],
                    id: 1,
                };
                const nep5Data = { ...nativeData, method: 'getnep5balances' };
                const nativeReq = httpPostPromise(currN2Network.rpcUrl, nativeData);
                const nepReq = httpPostPromise(currN2Network.rpcUrl, nep5Data);
                nativeBalanceReqs.push(nativeReq);
                nep5BalanceReqs.push(nepReq);
                if (item.fetchUTXO) {
                    const utxoData = { ...nativeData, method: 'getunspents' };
                    const utxoReq = httpPostPromise(currN2Network.rpcUrl, utxoData);
                    utxoReqs.push(utxoReq);
                }
            }
            try {
                Promise.all(nativeBalanceReqs.concat(nep5BalanceReqs).concat(utxoReqs)).then(async res => {
                    const returnData = {};
                    let i = 0;
                    let j = nativeBalanceReqs.length;
                    let k = j * 2;
                    for (const item of params) {
                        returnData[item.address] = [];
                        for (const assetId of item?.assets || []) {
                            const res_1 = (res[i]?.balances || []).find(asset_1 => assetId.includes(asset_1.asset));
                            const res_2 = (res[j]?.balance || []).find(asset_2 => assetId.includes(asset_2.asset_hash));
                            const assetRes = { assetID: assetId, amount: '0', symbol: '' };
                            let symbol = '';
                            if (res_1) {
                                if (assetId === NEO) {
                                    symbol = 'NEO';
                                }
                                if (assetId === GAS) {
                                    symbol = 'GAS';
                                }
                                assetRes.amount = res_1.value;
                            }
                            if (res_2) {
                                symbol = await getAssetSymbol(assetId, currN2Network.rpcUrl);
                                const decimal = await getAssetDecimal(assetId, currN2Network.rpcUrl);
                                assetRes.amount = new BigNumber(res_2.amount).shiftedBy(-decimal).toFixed();
                            }
                            assetRes.symbol = symbol;
                            returnData[item.address].push(assetRes);
                        }
                        if (!item.assets || item.assets.length === 0) {
                            for (const res_1 of (res[i].balances || [])) {
                                let symbol = '';
                                if (res_1.asset === NEO) {
                                    symbol = 'NEO';
                                }
                                if (res_1.asset === GAS) {
                                    symbol = 'GAS';
                                }
                                const assetRes = { assetID: res_1.asset, amount: res_1.value, symbol };
                                returnData[item.address].push(assetRes);
                            }
                            for (const res_2 of (res[j]?.balance || [])) {
                                const symbol = await getAssetSymbol(res_2.asset_hash, currN2Network.rpcUrl);
                                const decimal = await getAssetDecimal(res_2.asset_hash, currN2Network.rpcUrl);
                                const amount = new BigNumber(res_2.amount).shiftedBy(-decimal).toFixed();
                                const assetRes = { assetID: res_2.asset_hash, amount, symbol }
                                returnData[item.address].push(assetRes);
                            }
                        }
                        if (res[k] && res[k].address === item.address) {
                            res[k].balance.forEach(utxoAsset => {
                                const assetIndex = returnData[item.address].findIndex(assetItem =>
                                    assetItem.assetID.includes(utxoAsset.asset_hash));
                                if (assetIndex >= 0) {
                                    returnData[item.address][assetIndex].unspent = utxoAsset.unspent.map(uxtoItem => {
                                        uxtoItem.asset_id = utxoAsset.asset_hash;
                                        return uxtoItem;
                                    });
                                }
                            })
                            k++;
                        }
                        i++;
                        j++;
                    }
                    windowCallback({
                        return: requestTarget.Balance,
                        data: returnData,
                        ID: request.ID,
                        error: null
                    });
                    sendResponse('');
                })
            } catch (error) {
                windowCallback({
                    return: requestTarget.Balance,
                    data: null,
                    ID: request.ID,
                    error: ERRORS.RPC_ERROR
                });
                sendResponse('');
            }
            return;
        }
        case requestTarget.Transaction: {
            try {
                const parameter = request.parameter;
                const data = {
                    jsonrpc: '2.0',
                    method: 'getrawtransaction',
                    params: [parameter.txid, 1],
                    id: 1,
                };
                httpPost(currN2Network.rpcUrl, data, (res) => {
                    if (res?.result?.blocktime) {
                        windowCallback({
                            return: requestTarget.Transaction,
                            ID: request.ID,
                            data: res.result,
                            error: null
                        });
                    } else if (res?.error) {
                        windowCallback({
                            return: requestTarget.Transaction,
                            data: null,
                            ID: request.ID,
                            error: { ...ERRORS.RPC_ERROR, description: res?.error?.message || res?.error }
                        });
                    }
                })
            } catch (error) {
                windowCallback({
                    return: requestTarget.Transaction,
                    data: null,
                    ID: request.ID,
                    error
                });
            }
            sendResponse('');
            return;
        }
        case requestTarget.Block: {
            try {
                const parameter = request.parameter as GetBlockInputArgs;
                const nodeUrl = currN2Network.rpcUrl;
                httpPost(nodeUrl, {
                    jsonrpc: '2.0',
                    method: 'getblock',
                    params: [parameter.blockHeight, 1],
                    id: 1
                }, (response) => {
                    windowCallback({
                        return: requestTarget.Block,
                        data: response.error !== undefined ? null : response.result,
                        ID: request.ID,
                        error: response.error === undefined ? null : { ...ERRORS.RPC_ERROR, description: response.error.message }
                    });
                    sendResponse('');
                }, null);
            } catch (error) {
                windowCallback({
                    return: requestTarget.Block,
                    data: null,
                    ID: request.ID,
                    error
                });
                sendResponse('');
            }
            return;
        }
        case requestTarget.ApplicationLog: {
            try {
                const parameter = request.parameter as TransactionInputArgs;
                const nodeUrl = currN2Network.rpcUrl;
                httpPost(nodeUrl, {
                    jsonrpc: '2.0',
                    method: 'getapplicationlog',
                    params: [parameter.txid],
                    id: 1
                }, (response) => {
                    windowCallback({
                        return: requestTarget.ApplicationLog,
                        data: response.error !== undefined ? null : response.result,
                        ID: request.ID,
                        error: response.error === undefined ? null : { ...ERRORS.RPC_ERROR, description: response.error.message }
                    });
                    sendResponse('');
                }, null);
            } catch (error) {
                windowCallback({
                    return: requestTarget.ApplicationLog,
                    data: null,
                    ID: request.ID,
                    error
                });
                sendResponse('');
            }
            return;
        }
        case requestTarget.Storage: {
            try {
                const parameter = request.parameter as GetStorageArgs;
                const nodeUrl = currN2Network.rpcUrl;
                httpPost(nodeUrl, {
                    jsonrpc: '2.0',
                    method: 'getstorage',
                    params: [parameter.scriptHash, str2hexstring(parameter.key)],
                    id: 1
                }, (response) => {
                    windowCallback({
                        return: requestTarget.Storage,
                        data: response.error !== undefined ? null : ({ result: hexstring2str(response.result) } || null),
                        ID: request.ID,
                        error: response.error === undefined ? null : { ...ERRORS.RPC_ERROR, description: response.error.message }
                    });
                    sendResponse('');
                }, null);
            } catch (error) {
                windowCallback({
                    return: requestTarget.Storage,
                    data: null,
                    ID: request.ID,
                    error
                });
                sendResponse('');
            }
            return;
        }
        case requestTarget.InvokeRead: {
            const nodeUrl = currN2Network.rpcUrl;
            request.parameter = [request.parameter.scriptHash, request.parameter.operation, request.parameter.args];
            const args = request.parameter[2];
            args.forEach((item, index) => {
                if (item.type === 'Address') {
                    args[index] = {
                        type: 'Hash160',
                        value: getScriptHashFromAddress(item.value)
                    }
                } else if (item.type === 'Boolean') {
                    if (typeof item.value === 'string') {
                        if ((item.value && item.value.toLowerCase()) === 'true') {
                            args[index] = {
                                type: 'Boolean',
                                value: true
                            }
                        } else if (item.value && item.value.toLowerCase() === 'false') {
                            args[index] = {
                                type: 'Boolean',
                                value: false
                            }
                        } else {
                            windowCallback({
                                error: ERRORS.MALFORMED_INPUT,
                                return: requestTarget.InvokeRead,
                                ID: request.ID
                            });
                            window.close();
                        }
                    }
                }
            });
            request.parameter[2] = args;
            const returnRes = { data: {}, ID: request.ID, return: requestTarget.InvokeRead, error: null };
            httpPost(nodeUrl, {
                jsonrpc: '2.0',
                method: 'invokefunction',
                params: request.parameter,
                id: 1
            }, (res) => {
                res.return = requestTarget.InvokeRead;
                if (!res.error) {
                    returnRes.data = {
                        script: res.result.script,
                        state: res.result.state,
                        gas_consumed: res.result.gas_consumed,
                        stack: res.result.stack
                    };
                } else {
                    returnRes.error = { ...ERRORS.RPC_ERROR, description: res.error.message };
                }
                windowCallback(returnRes);
                sendResponse('');
            }, null);
            return;
        }
        case requestTarget.InvokeReadMulti: {
            try {
                const nodeUrl = currN2Network.rpcUrl;
                const requestData = request.parameter;
                requestData.invokeReadArgs.forEach((invokeReadItem: any, index) => {
                    invokeReadItem.args.forEach((item, itemIndex) => {
                        if (item.type === 'Address') {
                            invokeReadItem.args[itemIndex] = {
                                type: 'Hash160',
                                value: getScriptHashFromAddress(item.value)
                            }
                        } else if (item.type === 'Boolean') {
                            if (typeof item.value === 'string') {
                                if ((item.value && item.value.toLowerCase()) === 'true') {
                                    invokeReadItem.args[itemIndex] = {
                                        type: 'Boolean',
                                        value: true
                                    }
                                } else if (item.value && item.value.toLowerCase() === 'false') {
                                    invokeReadItem.args[itemIndex] = {
                                        type: 'Boolean',
                                        value: false
                                    }
                                } else {
                                    windowCallback({
                                        error: ERRORS.MALFORMED_INPUT,
                                        return: requestTarget.InvokeReadMulti,
                                        ID: request.ID
                                    });
                                    window.close();
                                }
                            }
                        }
                    });
                    requestData.invokeReadArgs[index] = [invokeReadItem.scriptHash, invokeReadItem.operation, invokeReadItem.args];
                })
                const returnRes = { data: [], ID: request.ID, return: requestTarget.InvokeReadMulti, error: null };
                let requestCount = 0;
                requestData.invokeReadArgs.forEach(item => {
                    httpPost(nodeUrl, {
                        jsonrpc: '2.0',
                        method: 'invokefunction',
                        params: item,
                        id: 1
                    }, (res) => {
                        requestCount++;
                        if (!res.error) {
                            returnRes.data.push({
                                script: res.result.script,
                                state: res.result.state,
                                gas_consumed: res.result.gas_consumed,
                                stack: res.result.stack
                            });
                        } else {
                            returnRes.error = { ...ERRORS.RPC_ERROR, description: res.error.message };
                        }
                        if (requestCount === requestData.invokeReadArgs.length) {
                            windowCallback(returnRes);
                            sendResponse('');
                        }
                    }, null);
                })
            } catch (error) {
                windowCallback({ data: [], ID: request.ID, return: requestTarget.InvokeReadMulti, error: ERRORS.RPC_ERROR });
                sendResponse('');
            }
            return;
        }
        case requestTarget.VerifyMessage: {
            const parameter = request.parameter as VerifyMessageArgs;
            const parameterHexString = str2hexstring(parameter.message);
            const lengthHex = (parameterHexString.length / 2).toString(16).padStart(2, '0');
            const messageHex = lengthHex + parameterHexString;
            const serializedTransaction = '010001f0' + messageHex + '0000';
            windowCallback({
                return: requestTarget.VerifyMessage,
                data: {
                    result: wallet2.verify(serializedTransaction, parameter.data, parameter.publicKey)
                },
                ID: request.ID
            });
            sendResponse('');
            return;
        }
        case requestTarget.SignMessage: {
            chrome.tabs.query({
                active: true,
                currentWindow: true
            }, (tabs) => {
                tabCurr = tabs;
            });
            const params = request.parameter;
            getStorage('connectedWebsites', () => {
                let queryString = '';
                for (const key in params) {
                    if (params.hasOwnProperty(key)) {
                        const value = params[key];
                        queryString += `${key}=${value}&`;
                    }
                }
                window.open(`index.html#popup/notification/signature?${queryString}messageID=${request.ID}`,
                    '_blank', 'height=620, width=386, resizable=no, top=0, left=0');
            });
            sendResponse('');
            return;
        }
        case requestTarget.Invoke: {
            chrome.tabs.query({
                active: true,
                currentWindow: true
            }, (tabs) => {
                tabCurr = tabs;
            });
            const params = request.parameter;
            getStorage('connectedWebsites', () => {
                let queryString = '';
                for (const key in params) {
                    if (params.hasOwnProperty(key)) {
                        const value = key === 'args' || key === 'assetIntentOverrides' || key === 'attachedAssets' ||
                            key === 'assetIntentOverrides' || key === 'txHashAttributes' || key === 'extra_witness' ?
                            JSON.stringify(params[key]) : params[key];
                        queryString += `${key}=${value}&`;
                    }
                }
                window.open(`index.html#popup/notification/invoke?${queryString}messageID=${request.ID}`,
                    '_blank', 'height=620, width=386, resizable=no, top=0, left=0');
            });
            sendResponse('');
            return;
        }
        case requestTarget.InvokeMulti: {
            chrome.tabs.query({
                active: true,
                currentWindow: true
            }, (tabs) => {
                tabCurr = tabs;
            });
            const params = request.parameter;
            getStorage('connectedWebsites', () => {
                let queryString = '';
                for (const key in params) {
                    if (params.hasOwnProperty(key)) {
                        const value = key === 'invokeArgs' || key === 'assetIntentOverrides' || key === 'attachedAssets' ||
                            key === 'assetIntentOverrides' || key === 'txHashAttributes' || key === 'extra_witness' ?
                            JSON.stringify(params[key]) : params[key];
                        queryString += `${key}=${value}&`;
                    }
                }
                window.open(`index.html#popup/notification/invoke-multi?${queryString}messageID=${request.ID}`,
                    '_blank', 'height=620, width=386, resizable=no, top=0, left=0');
            });
            sendResponse('');
            return;
        }
        case requestTarget.Send: {
            const parameter = request.parameter as SendArgs;
            let assetID = parameter.asset.length < 10 ? '' : parameter.asset;
            const symbol = parameter.asset.length >= 10 ? '' : parameter.asset;
            const data = {
                jsonrpc: '2.0',
                method: 'getnep5balances',
                params: [parameter.fromAddress],
                id: 1,
            };
            let isNep5 = true;
            if (assetID === NEO || assetID === GAS || symbol.toLowerCase() === 'neo' || symbol.toLowerCase() === 'gas') {
                if (symbol.toLowerCase() === 'neo') {
                    assetID = NEO;
                }
                if (symbol.toLowerCase() === 'gas') {
                    assetID = GAS;
                }
                request.parameter.asset = assetID;
                isNep5 = false;
                data.method = 'getaccountstate';
            }
            httpPost(currN2Network.rpcUrl, data, async (res) => {
                let assetBalance;
                if (res?.result?.balances && isNep5 === false) {
                    const tempAsset = res?.result?.balances.find(item => assetID.includes(item.asset));
                    if (tempAsset) {
                        assetBalance = tempAsset.value;
                    }
                }
                if (res?.result?.balance && isNep5 === true) {
                    const tempAsset = res?.result?.balance.find(item => assetID.includes(item.asset_hash));
                    if (tempAsset) {
                        assetBalance = tempAsset.amount;
                    }
                }
                if (assetBalance === undefined) {
                    windowCallback({
                        return: requestTarget.Send,
                        error: ERRORS.INSUFFICIENT_FUNDS,
                        ID: request.ID
                    });
                    sendResponse('');
                    return;
                }
                if (isNep5) {
                    const decimalsData = {
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'invokefunction',
                        params: [assetID, 'decimals'],
                    };
                    const decimalsRes: any = await httpPostPromise(currN2Network.rpcUrl, decimalsData);
                    let decimals = 0;
                    if (decimalsRes?.result?.stack) {
                        if (decimalsRes?.result.stack[0].type === 'Integer') {
                            decimals = Number(
                                decimalsRes?.result.stack[0].value || 0
                            );
                        }
                        if (decimalsRes?.result.stack[0].type === 'ByteArray') {
                            decimals = new BigNumber(
                                decimalsRes?.result.stack[0].value || 0,
                                16
                            ).toNumber();
                        }
                    }
                    assetBalance = new BigNumber(assetBalance).shiftedBy(-decimals);
                }
                if (new BigNumber(assetBalance).comparedTo(new BigNumber(parameter.amount)) >= 0) {
                    let queryString = '';
                    for (const key in parameter) {
                        if (parameter.hasOwnProperty(key)) {
                            const value = key === 'txHashAttributes' ? JSON.stringify(parameter[key]) : parameter[key];
                            queryString += `${key}=${value}&`;
                        }
                    }
                    chrome.tabs.query({
                        active: true,
                        currentWindow: true
                    }, (tabs) => {
                        tabCurr = tabs;
                    });
                    getLocalStorage('wallet', (wallet) => {
                        if (wallet !== undefined && wallet.accounts[0].address !== parameter.fromAddress) {
                            windowCallback({
                                return: requestTarget.Send,
                                error: ERRORS.MALFORMED_INPUT,
                                ID: request.ID
                            });
                        } else {
                            window.open(`index.html#popup/notification/transfer?${queryString}messageID=${request.ID}`,
                                '_blank', 'height=620, width=386, resizable=no, top=0, left=0');
                        }
                    });
                } else {
                    windowCallback({
                        return: requestTarget.Send,
                        error: ERRORS.INSUFFICIENT_FUNDS,
                        ID: request.ID
                    });
                    sendResponse('');
                    return;
                }
            })
            return true;
        }
        case requestTarget.Deploy: {
            chrome.tabs.query({
                active: true,
                currentWindow: true
            }, (tabs) => {
                tabCurr = tabs;
            });
            const params = request.parameter;
            getStorage('connectedWebsites', () => {
                let queryString = '';
                for (const key in params) {
                    if (params.hasOwnProperty(key)) {
                        const value = params[key];
                        queryString += `${key}=${value}&`;
                    }
                }
                window.open(`index.html#popup/notification/deploy?${queryString}messageID=${request.ID}`,
                    '_blank', 'height=620, width=386, resizable=no, top=0, left=0');
            });
            sendResponse('');
            return;
        }

        // neo3 dapi method
        case requestTargetN3.Balance: {
            const parameter = request.parameter as N3BalanceArgs;
            const params = parameter.params;
            const balanceReqs = [];
            for (const item of params) {
                (item.contracts || []).forEach((asset: string, index) => {
                    if (asset.toLowerCase() === 'neo') {
                        item.contracts[index] = NEO3;
                    }
                    if (asset.toLowerCase() === 'gas') {
                        item.contracts[index] = GAS3;
                    }
                });
                const reqData = {
                    jsonrpc: '2.0',
                    method: 'getnep17balances',
                    params: [item.address],
                    id: 1,
                };
                const tempReq = httpPostPromise(currN3Network.rpcUrl, reqData);
                balanceReqs.push(tempReq);
            }
            try {
                Promise.all(balanceReqs).then(async res => {
                    const returnData = {};
                    let i = 0;
                    for (const item of params) {
                        returnData[item.address] = [];
                        for (const assetId of item?.contracts || []) {
                            const res_1 = (res[i]?.balance || []).find(asset_1 => assetId.includes(asset_1.assethash));
                            const symbol = await getAssetSymbol(assetId, currN3Network.rpcUrl);
                            const assetRes = { assetID: assetId, amount: '0', symbol };
                            if (res_1) {
                                const decimal = await getAssetDecimal(assetId, currN3Network.rpcUrl);
                                assetRes.amount = new BigNumber(res_1.amount).shiftedBy(-decimal).toFixed();
                            }
                            returnData[item.address].push(assetRes);
                        }
                        if (!item.contracts || item.contracts.length === 0) {
                            for (const res_1 of (res[i]?.balance || [])) {
                                const symbol = await getAssetSymbol(res_1.assethash, currN3Network.rpcUrl);
                                const decimal = await getAssetDecimal(res_1.assethash, currN3Network.rpcUrl);
                                const amount = new BigNumber(res_1.amount).shiftedBy(-decimal).toFixed();
                                const assetRes = { assetID: res_1.assethash, amount, symbol }
                                returnData[item.address].push(assetRes);
                            }
                        }
                        i++;
                    }
                    windowCallback({
                        return: requestTargetN3.Balance,
                        ID: request.ID,
                        data: returnData,
                        error: null
                    });
                    sendResponse('');
                })
            } catch (error) {
                windowCallback({
                    return: requestTargetN3.Balance,
                    data: null,
                    ID: request.ID,
                    error: ERRORS.RPC_ERROR
                });
                sendResponse('');
            }
            return;
        }
        case requestTargetN3.Transaction: {
            try {
                const parameter = request.parameter as N3TransactionArgs;
                const data = {
                    jsonrpc: '2.0',
                    method: 'getrawtransaction',
                    params: [parameter.txid, true],
                    id: 1,
                };
                httpPost(currN3Network.rpcUrl, data, (res) => {
                    if (res?.result?.blocktime) {
                        windowCallback({
                            return: requestTargetN3.Transaction,
                            ID: request.ID,
                            data: res.result,
                            error: null
                        });
                    } else if (res?.error) {
                        windowCallback({
                            return: requestTargetN3.Transaction,
                            data: null,
                            ID: request.ID,
                            error: { ...ERRORS.RPC_ERROR, description: res?.error?.message || res?.error }
                        });
                    }
                    sendResponse('');
                })
            } catch (error) {
                windowCallback({
                    return: requestTargetN3.Transaction,
                    data: null,
                    ID: request.ID,
                    error
                });
                sendResponse('');
            }
            return;
        }
        case requestTargetN3.Block: {
            try {
                const parameter = request.parameter as N3GetBlockInputArgs;
                httpPost(request.nodeUrl, {
                    jsonrpc: '2.0',
                    method: 'getblock',
                    params: [parameter.blockHeight, 1],
                    id: 1
                }, (response) => {
                    windowCallback({
                        return: requestTargetN3.Block,
                        data: response.error !== undefined ? null : response.result,
                        ID: request.ID,
                        error: response.error === undefined ? null : { ...ERRORS.RPC_ERROR, description: response.error.message }
                    });
                    sendResponse('');
                }, null);
            } catch (error) {
                windowCallback({
                    return: requestTargetN3.Block,
                    data: null,
                    ID: request.ID,
                    error
                });
                sendResponse('');
            }
            return;
        }
        case requestTargetN3.ApplicationLog: {
            try {
                const parameter = request.parameter as N3ApplicationLogArgs;
                httpPost(request.nodeUrl, {
                    jsonrpc: '2.0',
                    method: 'getapplicationlog',
                    params: [parameter.txid],
                    id: 1
                }, (response) => {
                    windowCallback({
                        return: requestTargetN3.ApplicationLog,
                        data: response.error !== undefined ? null : response.result,
                        ID: request.ID,
                        error: response.error === undefined ? null : { ...ERRORS.RPC_ERROR, description: response.error.message }
                    });
                    sendResponse('');
                }, null);
            } catch (error) {
                windowCallback({
                    return: requestTargetN3.ApplicationLog,
                    data: null,
                    ID: request.ID,
                    error
                });
                sendResponse('');
            }
            return;
        }
        case requestTargetN3.Storage: {
            try {
                const parameter = request.parameter as N3GetStorageArgs;
                httpPost(request.nodeUrl, {
                    jsonrpc: '2.0',
                    method: 'getstorage',
                    params: [parameter.scriptHash, base64Encode(parameter.key)],
                    id: 1
                }, (response) => {
                    windowCallback({
                        return: requestTargetN3.Storage,
                        data: response.error !== undefined ? null : ({ result: response.result } || null),
                        ID: request.ID,
                        error: response.error === undefined ? null : { ...ERRORS.RPC_ERROR, description: response.error.message }
                    });
                    sendResponse('');
                }, null);
            } catch (error) {
                windowCallback({
                    return: requestTargetN3.Storage,
                    data: null,
                    ID: request.ID,
                    error
                });
                sendResponse('');
            }
            return;
        }
        case requestTargetN3.InvokeRead: {
            const parameter = request.parameter as N3InvokeReadArgs;
            const signers = parameter.signers.map(item => {
                return {
                    account: item.account,
                    scopes: item.scopes,
                    allowedcontracts: item.allowedContracts || undefined,
                    allowedgroups: item.allowedGroups || undefined,
                }
            });
            request.parameter = [parameter.scriptHash, parameter.operation, parameter.args, signers];
            const args = request.parameter[2];
            args.forEach((item, index) => {
                if (item.type === 'Address') {
                    args[index] = {
                        type: 'Hash160',
                        value: getScriptHashFromAddress(item.value)
                    }
                } else if (item.type === 'Boolean') {
                    if (typeof item.value === 'string') {
                        if ((item.value && item.value.toLowerCase()) === 'true') {
                            args[index] = {
                                type: 'Boolean',
                                value: true
                            }
                        } else if (item.value && item.value.toLowerCase() === 'false') {
                            args[index] = {
                                type: 'Boolean',
                                value: false
                            }
                        } else {
                            chrome.windowCallback({
                                error: ERRORS.MALFORMED_INPUT,
                                return: requestTargetN3.InvokeRead,
                                ID: request.ID
                            });
                            window.close();
                        }
                    }
                }
            });
            request.parameter[2] = args;
            const returnRes = { data: {}, ID: request.ID, return: requestTargetN3.InvokeRead, error: null };
            httpPost(request.nodeUrl, {
                jsonrpc: '2.0',
                method: 'invokefunction',
                params: request.parameter,
                id: 1
            }, (res) => {
                res.return = requestTargetN3.InvokeRead;
                if (!res.error) {
                    returnRes.data = res.result;
                } else {
                    returnRes.error = res.error;
                }
                windowCallback(returnRes);
                sendResponse('');
            }, null);
            return;
        }
        case requestTargetN3.InvokeReadMulti: {
            try {
                const requestData = request.parameter;
                const nodeUrl = currN3Network.rpcUrl;
                const signers = requestData.signers.map(item => {
                    return {
                        account: item.account,
                        scopes: item.scopes,
                        allowedcontracts: item.allowedContracts || undefined,
                        allowedgroups: item.allowedGroups || undefined,
                    }
                });
                requestData.invokeReadArgs.forEach((invokeReadItem: any, index) => {
                    invokeReadItem.args.forEach((item, itemIndex) => {
                        if (item === null || typeof item !== 'object') {
                            return;
                        } else if (item.type === 'Address') {
                            invokeReadItem.args[itemIndex] = {
                                type: 'Hash160',
                                value: getScriptHashFromAddress(item.value)
                            }
                        } else if (item.type === 'Boolean') {
                            if (typeof item.value === 'string') {
                                if ((item.value && item.value.toLowerCase()) === 'true') {
                                    invokeReadItem.args[itemIndex] = {
                                        type: 'Boolean',
                                        value: true
                                    }
                                } else if (item.value && item.value.toLowerCase() === 'false') {
                                    invokeReadItem.args[itemIndex] = {
                                        type: 'Boolean',
                                        value: false
                                    }
                                } else {
                                    chrome.windowCallback({
                                        error: ERRORS.MALFORMED_INPUT,
                                        return: requestTargetN3.InvokeReadMulti,
                                        ID: request.ID
                                    });
                                    window.close();
                                }
                            }
                        }
                    });
                    requestData.invokeReadArgs[index] =
                        [invokeReadItem.scriptHash, invokeReadItem.operation, invokeReadItem.args, signers];
                });
                const returnRes = { data: [], ID: request.ID, return: requestTargetN3.InvokeReadMulti, error: null };
                let requestCount = 0;
                requestData.invokeReadArgs.forEach(item => {
                    httpPost(nodeUrl, {
                        jsonrpc: '2.0',
                        method: 'invokefunction',
                        params: item,
                        id: 1
                    }, (res) => {
                        requestCount++;
                        if (!res.error) {
                            returnRes.data.push(res.result);
                        } else {
                            returnRes.data.push(res.error)
                        }
                        if (requestCount === requestData.invokeReadArgs.length) {
                            windowCallback(returnRes);
                            sendResponse('');
                        }
                    }, null);
                })
            } catch (error) {
                console.log(error)
                windowCallback({ data: [], ID: request.ID, return: requestTargetN3.InvokeReadMulti, error });
                sendResponse('');
            };
            return;
        }
        case requestTargetN3.VerifyMessage: {
            const parameter = request.parameter as N3VerifyMessageArgs;
            const parameterHexString = u3.str2hexstring(parameter.message);
            const lengthHex = u3.num2VarInt(parameterHexString.length / 2);
            const concatenatedString = lengthHex + parameterHexString;
            const messageHex = '010001f0' + concatenatedString + '0000';
            const result = wallet3.verify(messageHex, parameter.data, parameter.publicKey);
            windowCallback({
                return: requestTargetN3.VerifyMessage,
                data: {
                    result
                },
                ID: request.ID
            });
            sendResponse('');
            return;
        }
        case requestTargetN3.SignMessage: {
            chrome.tabs.query({
                active: true,
                currentWindow: true
            }, (tabs) => {
                tabCurr = tabs;
            });
            const params = request.parameter;
            getStorage('connectedWebsites', () => {
                let queryString = '';
                for (const key in params) {
                    if (params.hasOwnProperty(key)) {
                        const value = params[key];
                        queryString += `${key}=${value}&`;
                    }
                }
                window.open(`index.html#popup/notification/neo3-signature?${queryString}messageID=${request.ID}`,
                    '_blank', 'height=620, width=386, resizable=no, top=0, left=0');
            });
            sendResponse('');
            return;
        }
        case requestTargetN3.SignTransaction: {
            chrome.tabs.query({
                active: true,
                currentWindow: true
            }, (tabs) => {
                tabCurr = tabs;
            });
            const params = request.parameter;
            getStorage('connectedWebsites', (res) => {
                let queryString = '';
                for (const key in params) {
                    if (params.hasOwnProperty(key)) {
                        const value = key === 'transaction' ? JSON.stringify(params[key]) : params[key];
                        queryString += `${key}=${value}&`;
                    }
                }
                window.open(`index.html#popup/notification/neo3-sign-transaction?${queryString}messageID=${request.ID}`,
                    '_blank', 'height=620, width=386, resizable=no, top=0, left=0');
            });
            sendResponse('');
            return;
        }
        case requestTargetN3.Invoke: {
            chrome.tabs.query({
                active: true,
                currentWindow: true
            }, (tabs) => {
                tabCurr = tabs;
            });
            const params = request.parameter as N3InvokeArgs;
            const currWallet = await getLocalStorage('wallet', () => { });
            const tempScriptHash = wallet3.getScriptHashFromAddress(
                currWallet.accounts[0].address
            );
            if (!params.signers) {
                params.signers = [{
                    account: tempScriptHash,
                    scopes: WitnessScope.CalledByEntry
                }];
            } else {
                if (!params.signers[0].account) {
                    params.signers[0].account = tempScriptHash;
                }
                if (params.signers[0].scopes === undefined) {
                    params.signers[0].scopes = WitnessScope.CalledByEntry;
                }
            };
            getStorage('connectedWebsites', async () => {
                const storageName = `InvokeArgsArray`;
                const saveData = {};
                const invokeArgsArray = await getLocalStorage(storageName, () => {}) || [];
                const data = {
                    ...params,
                    messageID: request.ID
                }
                saveData[storageName] = [data, ...invokeArgsArray];
                setLocalStorage(saveData);
                window.open(`index.html#popup/notification/neo3-invoke?messageID=${request.ID}`,
                    '_blank', 'height=620, width=386, resizable=no, top=0, left=0');
            });
            sendResponse('');
            return;
        }
        case requestTargetN3.InvokeMultiple: {
            chrome.tabs.query({
                active: true,
                currentWindow: true
            }, (tabs) => {
                tabCurr = tabs;
            });
            const params = request.parameter as N3InvokeMultipleArgs;
            const currWallet = await getLocalStorage('wallet', () => { });
            const tempScriptHash = wallet3.getScriptHashFromAddress(
                currWallet.accounts[0].address
            );
            if (!params.signers) {
                params.signers = [{
                    account: tempScriptHash,
                    scopes: WitnessScope.CalledByEntry
                }];
            } else {
                if (!params.signers[0].account) {
                    params.signers[0].account = tempScriptHash;
                }
                if (params.signers[0].scopes === undefined) {
                    params.signers[0].scopes = WitnessScope.CalledByEntry;
                }
            };
            getStorage('connectedWebsites', async () => {
                let queryString = '';
                for (const key in params) {
                    if (params.hasOwnProperty(key)) {
                        const value = key === 'invokeArgs' || key === 'signers' ?
                            JSON.stringify(params[key]) : params[key];
                        queryString += `${key}=${value}&`;
                    }
                }
                const storageName = `InvokeArgsArray`;
                const saveData = {};
                const invokeArgsArray = await getLocalStorage(storageName, () => {}) || [];
                const data = {
                    ...params,
                    messageID: request.ID
                }
                saveData[storageName] = [data, ...invokeArgsArray];
                setLocalStorage(saveData);
                window.open(`index.html#popup/notification/neo3-invoke-multiple?messageID=${request.ID}`,
                    '_blank', 'height=620, width=386, resizable=no, top=0, left=0');
            });
            sendResponse('');
            return;
        }
        case requestTargetN3.Send: {
            const parameter = request.parameter as N3SendArgs;
            let assetID = parameter.asset.length < 10 ? '' : parameter.asset;
            const symbol = parameter.asset.length >= 10 ? '' : parameter.asset;
            if (symbol.toLowerCase() === 'neo') {
                assetID = NEO3;
            }
            if (symbol.toLowerCase() === 'gas') {
                assetID = GAS3;
            }
            request.parameter.asset = assetID;
            const data = {
                jsonrpc: '2.0',
                method: 'getnep17balances',
                params: [parameter.fromAddress],
                id: 1,
            };
            httpPost(currN3Network.rpcUrl, data, (res) => {
                console.log(res);
                const index = res?.result?.balance ? res?.result?.balance.findIndex(item => assetID.includes(item.assethash)) : -1;
                if (index < 0) {
                    windowCallback({
                        return: requestTargetN3.Send,
                        error: ERRORS.INSUFFICIENT_FUNDS,
                        ID: request.ID
                    });
                    sendResponse('');
                    return;
                }
                let assetBalance = res?.result?.balance[index].amount;
                const decimalsData = {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'invokefunction',
                    params: [assetID, 'decimals'],
                };
                httpPost(currN3Network.rpcUrl, decimalsData, (decimalsRes) => {
                    let decimals = 0;
                    if (decimalsRes?.result.stack) {
                        if (decimalsRes?.result.stack[0].type === 'Integer') {
                            decimals = Number(
                                decimalsRes?.result.stack[0].value || 0
                            );
                        }
                        if (decimalsRes?.result.stack[0].type === 'ByteArray') {
                            decimals = new BigNumber(
                                decimalsRes?.result.stack[0].value || 0,
                                16
                            ).toNumber();
                        }
                    }
                    assetBalance = new BigNumber(assetBalance).shiftedBy(-decimals);
                    if (assetBalance.comparedTo(new BigNumber(parameter.amount)) >= 0) {
                        let queryString = '';
                        for (const key in parameter) {
                            if (parameter.hasOwnProperty(key)) {
                                const value = parameter[key];
                                queryString += `${key}=${value}&`;
                            }
                        }
                        chrome.tabs.query({
                            active: true,
                            currentWindow: true
                        }, (tabs) => {
                            tabCurr = tabs;
                        });
                        getLocalStorage('wallet', (wallet) => {
                            if (wallet !== undefined && wallet.accounts[0].address !== parameter.fromAddress) {
                                windowCallback({
                                    return: requestTargetN3.Send,
                                    error: ERRORS.MALFORMED_INPUT,
                                    ID: request.ID
                                });
                                sendResponse('');
                            } else {
                                window.open(`index.html#popup/notification/neo3-transfer?${queryString}messageID=${request.ID}`,
                                    '_blank', 'height=620, width=386, resizable=no, top=0, left=0');
                            }
                        });
                    } else {
                        windowCallback({
                            return: requestTargetN3.Send,
                            error: ERRORS.INSUFFICIENT_FUNDS,
                            ID: request.ID
                        });
                        sendResponse('');
                        return;
                    }
                })
            });
            return true;
        }
        case requestTargetN3.AddressToScriptHash: {
            const scriptHash = wallet3.getScriptHashFromAddress(request.parameter.address);
            windowCallback({
                data: { scriptHash },
                return: requestTargetN3.AddressToScriptHash,
                ID: request.ID
            });
            return;
        }
        case requestTargetN3.ScriptHashToAddress: {
            const scriptHash = request.parameter.scriptHash;
            const str = scriptHash.startsWith('0x') ? scriptHash.substring(2, 44) : scriptHash;
            const address = wallet3.getAddressFromScriptHash(str);
            windowCallback({
                data: { address },
                return: requestTargetN3.ScriptHashToAddress,
                ID: request.ID
            });
            return;
        }
    }
    return true;
});

export function windowCallback(data) {
    chrome.tabs.query({
    }, (tabs: any) => {
        // console.log(tabs);
        // tabCurr = tabs;
        if (tabs.length > 0) {
            tabs.forEach(item => {
                chrome.tabs.sendMessage(item.id, data, () => {
                    // tabCurr = null;
                });
            })
        }
    });
}
