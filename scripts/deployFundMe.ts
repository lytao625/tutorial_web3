import hre from "hardhat"

import {LOCKTIME, SEPOLIA_ETHUSD_DATAFEED} from "../hardhat.config.user.js";

const { ethers } = await hre.network.create();

async function main() {
    // create factory 
    const fundmeFactory = await ethers.getContractFactory("FundMe")
    console.log("contract deploying ...")
    // deploy contract from factory
    const fundme = await fundmeFactory.deploy(SEPOLIA_ETHUSD_DATAFEED, LOCKTIME)
    await fundme.waitForDeployment()
    console.log("contract has been deployed successfully, address is "+fundme.target)

    // verify fundMe：用 provider 读取真实 chainId（bigint），不要读 hre.network.config
    const { chainId } = await ethers.provider.getNetwork();
    if(chainId === 11155111n) {
        console.log("verifying on etherscan ...");
        await hre.tasks.getTask("verify").run({
            address: fundme.target,
            constructorArgs: [SEPOLIA_ETHUSD_DATAFEED, String(LOCKTIME)],
        });
    }

    // get two accounts
    const [acc1, acc2] = await ethers.getSigners()
    console.log(`2 accounts address are ${acc1.address} and ${acc2.address}`)

    // fund contract with first account
    const fundTx1 = await fundme.connect(acc1).fund({value: ethers.parseEther("0.005")})
    await fundTx1.wait()
    // get balance of contract after the first account fund
    const balance1OfContract = await ethers.provider.getBalance(fundme.target)
    console.log(`Balance of contract is ${balance1OfContract}`)

    // fund contract with second account
    const fundTx2 = await fundme.connect(acc2).fund({value: ethers.parseEther("0.005")})
    await fundTx2.wait()
    // get balance of contract after the second account fund
    const balance2OfContract = await ethers.provider.getBalance(fundme.target)
    console.log(`Balance of contract is ${balance2OfContract}`)

    // check mapping 
    const balance1 = await fundme.fundersToAmount(acc1.address)
    const balance2 = await fundme.fundersToAmount(acc2.address)
    console.log(`Balance of the first account: ${balance1}`)
    console.log(`Balance of the second account: ${balance2}`)
}

main().then().catch((error) => {
    console.error(error);
    process.exit(1);
});