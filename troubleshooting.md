# FundMe 项目问题总结

> 记录开发部署脚本与单元测试过程中遇到的问题、根因与解决方法。
> 技术栈：Hardhat 3 + viem（hardhat-toolbox-viem）+ hardhat-deploy + rocketh + node:test。

---

## 目录

1. [部署脚本](#一部署脚本)
2. [TypeScript 类型 / 编译](#二typescript-类型--编译)
3. [artifact / generated 目录](#三artifact--generated-目录)
4. [网络与分支判断](#四网络与分支判断)
5. [rocketh 的 env 对象](#五rocketh-的-env-对象)
6. [单元测试](#六单元测试)

---

## 一、部署脚本

### 1.1 `TypeError: Cannot read properties of undefined (reading 'address')`

**错误信息**

```
TypeError: Cannot read properties of undefined (reading 'address')
    at main (scripts/deployFundMe.ts:29:48)
```

**原因**

```ts
const [deployer, acc1, acc2] = await ethers.getSigners()
console.log(`... ${acc1.address} ...`)   // acc1 是 undefined
```

`getSigners()` 返回的数量 = 网络 `accounts` 里配置的私钥数量。sepolia 网络只配了 1 个私钥：

```ts
sepolia: {
  type: "http",
  url: configVariable("SEPOLIA_RPC_URL"),
  accounts: [configVariable("PRIVATE_KEY")],   // 只有 1 个
},
```

所以解构后 `acc1`、`acc2` 都是 `undefined`。真实网络上无法凭空「创建」带余额的账号。

**解决**

- 推荐：把「多账号测试合约函数」放到本地模拟网络（本地默认 20 个已充值账号），和部署脚本拆开。
- 或：在 sepolia 的 `accounts` 里再配两个私钥，并给它们领测试币。

---

## 二、TypeScript 类型 / 编译

### 2.1 相对导入路径需要 `.js` 扩展名（TS2835 / TS5097 / TS7006）

**错误信息（VSCode 报 3 个）**

```
1. 当 --moduleResolution 为 node16 或 nodenext 时，相对导入路径需要显式文件扩展名 ...(TS2835)
2. 启用 allowImportingTsExtensions 时，导入路径只能以 .ts 扩展名结尾 ...(TS5097)
3. 参数 "env" 隐式具有 "any" 类型 ...(TS7006)
```

**原因**

`tsconfig.json` 里 `"module": "node20"`，对应 NodeNext 解析规则：所有相对导入必须写显式扩展名，且**不能写 `.ts`**，要写 `.js`（指向同名 `.ts` 文件）。

- `import ... from '../rocketh/deploy'` → 缺少扩展名（TS2835）
- `import ... from "../hardhat.config.user.ts"` → 不能带 `.ts`（TS5097）
- 错误 1 让 `deployScript` 解析失败变成 `any`，于是回调参数 `env` 隐式 `any`（TS7006，是错误 1 的连锁反应）

**解决**

```ts
// 改前
import {deployScript, artifacts} from '../rocketh/deploy';
import {LOCKTIME, SEPOLIA_ETHUSD_DATAFEED} from "../hardhat.config.user.ts";

// 改后
import {deployScript, artifacts} from '../rocketh/deploy.js';
import {LOCKTIME, SEPOLIA_ETHUSD_DATAFEED} from "../hardhat.config.user.js";
```

修好导入后，错误 3 会一起消失（`deployScript` 恢复泛型类型，`env` 得到正确上下文类型）。

> 为什么 `npx hardhat deploy` 能成功而 VSCode 报错：Hardhat 用 esbuild 剥离类型、不做类型检查；VSCode 的 tsserver 才做严格类型检查。

### 2.2 `Type 'number' is not assignable to type 'bigint'`

**原因**

修好上面的导入后，可能暴露新的类型错误：构造函数参数是 `uint56`（对应 `bigint`），而 `LOCKTIME` 是 `number`。

```ts
const LOCKTIME = 120   // number
```

**解决**

```ts
const LOCKTIME = 120n   // bigint
```

同理 `INITIAL_FEED_ANSWER = 300000000000`（对应 `int256`）也应写成 `300000000000n`。

---

## 三、artifact / generated 目录

### 3.1 mock 合约编译后 generated 目录没有生成对应 .ts

**现象**

`contracts/mocks/MockV3Aggregator.sol` 编译后，`generated/artifacts/` 和 `generated/abis/` 里没有 `MockV3Aggregator.*` 文件。

**原因**

```solidity
// 这个文件只有 import，没有声明任何合约
import {MockV3Aggregator} from "@chainlink/contracts/src/v0.8/shared/mocks/MockV3Aggregator.sol";
```

Solidity 的 `import` 只是引入作用域，不是定义也不是 re-export。文件里没有合约 → 不生成 `.json` artifact → `generated/` 也就没有对应 `.ts`。

**解决**：让文件真正定义一个合约（继承 Chainlink 的 mock，保留名字）：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {MockV3Aggregator as ChainlinkMockV3Aggregator} from "@chainlink/contracts/src/v0.8/shared/mocks/MockV3Aggregator.sol";

contract MockV3Aggregator is ChainlinkMockV3Aggregator {
    constructor(uint8 _decimals, int256 _initialAnswer)
        ChainlinkMockV3Aggregator(_decimals, _initialAnswer)
    {}
}
```

然后 `npx hardhat compile` 重新生成。

---

## 四、网络与分支判断

### 4.1 未指定 `--network` 时默认是「default」而不是「hardhat / Anvil」

**原因**

- Hardhat 3 把内置内存网络的默认名从 `hardhat` 改成了 **`default`**（`DEFAULT_NETWORK_NAME = "default"`），类型是 `edr-simulated`、chainId `31337`。
- 未指定 `--network` 时，`hre.network.create()` 走 `default`（内存 EDR 网络）。
- 之所以容易和「Anvil」混淆：Hardhat 内存网络和 Anvil 都用 chainId `31337`，`localhost`/Anvil 也都监听 `http://localhost:8545`。

**关键点**：默认部署到的是 Hardhat 3 的内存网络（名 `default`），不是真的连到了 Anvil 节点。

### 4.2 部署脚本里区分「本地测试」和「sepolia」

**判断依据**（`env` 自带）

| 字段 | 本地 | sepolia |
|---|---|---|
| `env.name` | `default` / `hardhatMainnet` / `hardhatOp` | `sepolia` |
| `env.network.chain.id` | `31337` | `11155111` |

推荐用 **chainId**（不依赖网络命名）：

```ts
export default deployScript(
    async (env) => {
        if (env.network.chain.id === 11155111) {
            // sepolia：用真实 Chainlink 数据源
            datafeedAddr = SEPOLIA_ETHUSD_DATAFEED;
        } else {
            // 本地：用 00 脚本部署的 mock 地址
            datafeedAddr = env.get('MockV3Aggregator').address;
        }
        await env.deploy('FundMe', {
            artifact: artifacts.FundMe,
            account: env.namedAccounts.deployer,
            args: [datafeedAddr, LOCKTIME],
        });
    },
    {tags: ['FundMe'], dependencies: ['MockV3Aggregator']},
);
```

---

## 五、rocketh 的 env 对象

### 5.1 env 是什么、如何获取

`env` 是 rocketh 的 `EnhancedEnvironment` = `Environment` 核心字段 + 柯里化进来的扩展函数（`deploy`/`read`/`execute`/`tx` 等）。

**部署脚本里**：自动注入，是 `deployScript` 回调的第一个参数：

```ts
export default deployScript(async (env) => { ... }, {tags: [...]});
```

**测试脚本里**：手动加载：

```ts
import hre from "hardhat";
import {loadEnvironmentFromHardhat} from '../rocketh/environment.js';

const env = await loadEnvironmentFromHardhat({hre});
```

### 5.2 env 常用字段与方法

| 字段/方法 | 说明 |
|---|---|
| `env.name` | 网络名 |
| `env.network.chain.id` | chainId |
| `env.network.chain.name` | 链名 |
| `env.namedAccounts` | 命名账户（如 `deployer`），值是地址字符串 |
| `env.namedSigners` | 命名账户对应 signer |
| `env.get(name)` / `env.getOrNull(name)` | 读取部署的 `Deployment`（含 `.address`/`.abi`） |
| `env.deploy(name, {artifact, account, args, value})` | 部署合约 |
| `env.read(deployment, {functionName, args})` | 调 view/pure 函数 |
| `env.readByName(name, {...})` | 按部署名调 view |
| `env.execute(deployment, {functionName, args, account, value})` | 发写交易 |
| `env.executeByName(name, {...})` | 按部署名发写交易 |

---

## 六、单元测试

### 6.1 `fundMe.owner is not a function`

**原因**

`env.get()` 返回的是**普通 `Deployment` 数据对象**（`{address, abi, ...}`），不是绑定方法的合约实例，没有 `.owner()` 方法。

Solidity 确实为 `public` 变量自动生成 getter，但它体现在 **ABI** 里（`owner()` 编译成 view 函数），必须通过合约抽象层（viem/ethers）或 `env.read` 调用。

**解决**

```ts
// 方式一：rocketh 的 env.read（推荐）
const owner = await env.read(fundMe, {functionName: 'owner'});

// 方式二：viem 合约实例
const contract = await viem.getContractAt('FundMe', fundMe.address);
const owner = await contract.read.owner();
```

### 6.2 地址比较大小写不一致（EIP-55 校验和）

**现象**

```
AssertionError: expected '…' to equal '…'
```

**原因**

- `env.read`（内部走 viem 解码 `address`）返回 **EIP-55 校验和格式**（大小写混合）。
- `namedAccounts.deployer`（rocketh）返回**小写**地址。
- `assert.equal`（`===`）按字符串逐字符比较，大小写不同就判不相等。

**解决**

```ts
// 方案 A：都转小写
assert.equal(owner.toLowerCase(), namedAccounts.deployer.toLowerCase());

// 方案 B：viem 地址比较（推荐）
import { isAddressEqual } from "viem";
assert.isTrue(isAddressEqual(owner, namedAccounts.deployer));
```

### 6.3 payable 函数的 msg.value 如何传

**要点**：`msg.value` 通过 **`value` 字段**传，不是 `args`。`args` 只对应函数形参。

`fund()` 无参数，所以：

```ts
await env.execute(fundMe, {
    account: namedAccounts.deployer,
    functionName: 'fund',
    value: ethers.parseEther('0.1'),   // msg.value
    // 没有 args
});
```

**revert 顺序**（`fund` 里两个 require）：

```solidity
require(convertETHtoUSD(msg.value) >= MINIMUM_VALUE, "More eth needed");   // ① 先查金额
require(deployTime + lockTime > block.timestamp, "Fund window is closed."); // ② 再查窗口
```

- 金额不足 → `"More eth needed"`
- 金额够但窗口关闭 → `"Fund window is closed."`

### 6.4 断言 API 选型（revertedWith / revertWith / assert.rejects）

| 写法 | 所属 | 适用场景 |
|---|---|---|
| `await expect(p).to.be.revertedWith("x")` | hardhat-ethers-chai-matchers | ethers + mocha，且注册了插件 |
| `await viem.assertions.revertWith(p, "x")` | hardhat-viem-assertions | viem 合约调用（`contract.write`/`read`） |
| `await assert.rejects(fn, predicate)` | node:assert | 任意 Promise，最通用 |

**注意**：viem 版方法名是 `revertWith`（**没有 ed**），是函数不是链式 matcher。

### 6.5 `env.execute` 不能直接配合 `viem.assertions.revertWith`

**原因**

- rocketh 的 `env.execute` 是「编码后广播原始交易」，revert 时抛的是 `UnsuccessfulTransactionError`，**不含 revert data（revert reason）**。
- `viem.assertions.revertWith` 需要的是**带 revert data 的 viem 合约调用 promise**（viem 会先 simulate，revert 时抛带 `data` 的错误）。

**解决**：用 viem 合约实例调用：

```ts
const fundMeContract = await viem.getContractAt('FundMe', fundMe.address);
await viem.assertions.revertWith(
    fundMeContract.write.fund({ value: ethers.parseEther('0.1') }),
    'Fund window is closed.',
);
```

### 6.6 `AbiEncodingLengthMismatchError`（参数个数不匹配）

**错误信息**

```
AbiEncodingLengthMismatchError: ABI encoding params/values length mismatch.
Expected length (params): 1
Given length (values): 0
```

**原因**（两个 bug 叠加）

```ts
// 错误写法
const balance = await fundMeContract.read.fundersToAmount(namedAccounts.deployer.address);
```

1. `namedAccounts.deployer` 本身就是地址字符串，再取 `.address` 得到 `undefined` → viem 拿到 0 个参数。
2. viem 的 `read`/`write` 参数必须用**数组**包装（对应 ABI 参数列表）。

**解决**

```ts
const balance = await fundMeContract.read.fundersToAmount([namedAccounts.deployer]);
```

### 6.7 换签名账户调用函数（非 owner 调用）

**背景**

viem 合约实例的 `write` 默认用第一个账户签名（hardhat-viem 的默认 wallet client = `getAccounts()[0]`，通常是 deployer/owner）。测试「非 owner 不能调用」这类场景时，需要换一个签名账户。

**方法**：用 `viem.getWalletClient(地址)` 拿到该账户的 wallet client，再绑到合约实例上：

```ts
const admin = namedAccounts.admin;              // 非 owner 账户
const adminClient = await viem.getWalletClient(admin);
const fundMeAsAdmin = await viem.getContractAt("FundMe", fundMe.address, {
    client: { wallet: adminClient },
});
// 之后 fundMeAsAdmin.write.xxx() 就是从 admin 账户发交易
```

**完整示例**（测试非 owner 调用 `getFund` 失败）：

```ts
it("window open, fund target reached, not owner, getFund failed", async function() {
    // 1. owner（默认账户）先充值，让余额达到 TARGET
    await fundMeContract.write.fund({ value: ethers.parseEther("1") });

    // 2. 用非 owner 账户（admin，rocketh config 里 index 1）构造合约实例
    const admin = namedAccounts.admin;
    const adminClient = await viem.getWalletClient(admin);
    const fundMeAsAdmin = await viem.getContractAt("FundMe", fundMe.address, {
        client: { wallet: adminClient },
    });

    // 3. 非 owner 调用 getFund → revert
    await viem.assertions.revertWith(
        fundMeAsAdmin.write.getFund(),
        "This function can only be called by owner.",
    );
})
```

**要点**

- `viem.getWalletClient(地址)` 直接用传入地址创建 wallet client，签名由节点完成。
- `getContractAt` 的 `client: { wallet }` 只传 wallet 即可，public client 走默认。
- rocketh 侧 `env.execute(..., {account: 地址})` 也能指定账户，但 revert 不带 reason（见 6.5），要断言具体消息时用 viem 方式。

---

## 附：常用速查

- **看当前网络**：`env.name`、`env.network.chain.id`、`env.network.chain.name`
- **sepolia chainId**：`11155111`；**本地 chainId**：`31337`
- **viem 传参**：合约 `read`/`write` 的 args 一律用数组 `[arg1, arg2]`，0 参函数直接传 options（如 `{value: 1n}`）
- **msg.value**：`value` 字段（`bigint`），不是 `args`
- **地址比较**：先 `toLowerCase()` 或 `isAddressEqual`
- **断言 revert**：viem 合约调用用 `viem.assertions.revertWith(promise, "reason")`；rocketh `env.execute` 用 `assert.rejects`
