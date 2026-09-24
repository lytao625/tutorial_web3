import hre from "hardhat"

const { ethers } = await hre.network.create();

const SEPOLIA_ETHUSD_DATAFEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306"
const LOCKTIME = "10"

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
            constructorArgs: [SEPOLIA_ETHUSD_DATAFEED, LOCKTIME],
        });
    }
}

main().then().catch((error) => {
    console.error(error);
    process.exit(1);
});