//SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/* 完成一个融资智能合约，实现如下功能：
** 1. 创建一个融资收款函数
** 2. 记录投资人并查看
** 3. 在锁定期内，到达目标值，创业者可以提款
** 4. 在锁定期内，未到达目标值，投资人在锁定期后可退款
*/

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract FundMe {
    // 记录投资人和投资资金额
    mapping(address => uint256) public fundersToAmount;
    
    // 记录合约所属者
    address public owner;

    // 定义目标融资金额（USD）
    uint256 constant TARGET = 100 * 10 ** 18;
    // 定义最小投资金额（USD）
    uint256 constant MINIMUM_VALUE = 10 * 10 ** 18;

    // 记录合约部署时间
    uint256 public deployTime = block.timestamp;
    // 记录融资时间(s)
    uint256 public lockTime;

    // ETH:USD价格转换数据源
    AggregatorV3Interface public dataFeed; // change private to public for unit test

    event fundEvent(address indexed inventor, address indexed to, uint256 amount);
    event getFundEvent(address indexed ownerAddr, uint256 value);

    constructor(address dataFeedAddress, uint56 _lockTime) {
        owner = msg.sender;
        lockTime = _lockTime;
        dataFeed = AggregatorV3Interface(dataFeedAddress);
    }

    /**
    * Returns the latest answer.
    */
    function getChainlinkDataFeedLatestAnswer() public view returns (int256) {
        // prettier-ignore
        (
            /* uint80 roundId */
            ,
            int256 answer,
            /*uint256 startedAt*/
            ,
            /*uint256 updatedAt*/
            ,
            /*uint80 answeredInRound*/
        ) = dataFeed.latestRoundData();
        return answer;
    }

    // 获取实时的USD价格，并把ETH转化为实时的USD
    function convertETHtoUSD(uint256 ethAmount) public view returns (uint256) {
        uint256 ethPrice = uint256(getChainlinkDataFeedLatestAnswer());
        return ethAmount * ethPrice / (10 ** 8);
    } 

    // 融资收款函数
    function fund() external payable{
        // 要求投资达到最小额度
        require(convertETHtoUSD(msg.value) >= MINIMUM_VALUE, "More eth needed");
        // 要求在锁定期内投资
        require(deployTime + lockTime > block.timestamp, "Fund window is closed.");
        fundersToAmount[msg.sender] += msg.value;
        emit fundEvent(msg.sender, address(this), msg.value);
    }

    // 融资完成提取资金
    function getFund() external windowClosed {
        // 融资额达成，才允许提款
        require(convertETHtoUSD(address(this).balance) >= TARGET, "Target is not reached.");
        // 只允许所有者才能提款
        require(owner == msg.sender, "This function can only be called by owner.");
        bool success;
        uint256 balance = address(this).balance;
        (success, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(success, "Transfer tx failed.");
        fundersToAmount[msg.sender] = 0;
        emit getFundEvent(msg.sender, balance);
    }

    // 未完成融资退款
    function reFund() external windowClosed {
        // 融资额未达成，则退款
        require(convertETHtoUSD(address(this).balance) < TARGET, "Target is reached.");
        require(fundersToAmount[msg.sender] > 0, "There isnot fund for you.");
        bool success;
        (success, ) = payable(msg.sender).call{value: fundersToAmount[msg.sender]}("");
        require(success, "Transfer tx failed.");
        fundersToAmount[msg.sender] = 0;
    }

    modifier windowClosed {
        require(deployTime + lockTime <= block.timestamp, "Window is not closed.");
        _;
    }
}
