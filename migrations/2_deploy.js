const fs = require("fs");
// Libs
const ECVerifyLib = artifacts.require("ECVerify");
const paramManagerLib = artifacts.require("ParamManager");
const rollupUtilsLib = artifacts.require("RollupUtils");
const Types = artifacts.require("Types");

// Contracts Deployer
const governanceContract = artifacts.require("Governance");
const MTUtilsContract = artifacts.require("MerkleTreeUtils");
const loggerContract = artifacts.require("Logger");
const tokenRegistryContract = artifacts.require("TokenRegistry");

const nameRegistryContract = artifacts.require("NameRegistry");
const incrementalTreeContract = artifacts.require("IncrementalTree");
const depositManagerContract = artifacts.require("DepositManager");
const rollupContract = artifacts.require("Rollup");
const testTokenContract = artifacts.require("TestToken");
const merkleTreeUtilsContract = artifacts.require("MerkleTreeUtils");
const coordinatorProxyContract = artifacts.require("CoordinatorProxy");
const POBContract = artifacts.require("POB");
const utils = "../test/helpers/utils.ts";

function writeContractAddresses(contractAddresses) {
  fs.writeFileSync(
    `${process.cwd()}/contractAddresses.json`,
    JSON.stringify(contractAddresses, null, 2) // Indent 2 spaces
  );
}

module.exports = async function (deployer) {
  // picked address from mnemoic
  var coordinator = "0x9fB29AAc15b9A4B7F17c3385939b007540f4d791";
  var max_depth = 4;
  var maxDepositSubtreeDepth = 1;

  // deploy libs
  await deployer.deploy(ECVerifyLib);
  await deployer.deploy(Types);
  const paramManagerInstance = await deployer.deploy(paramManagerLib);
  await deployer.deploy(rollupUtilsLib);

  // deploy name registry
  const nameRegistryInstance = await deployer.deploy(nameRegistryContract);

  // deploy governance
  const governanceInstance = await deployAndRegister(
    deployer,
    governanceContract,
    [],
    [
      max_depth,
      maxDepositSubtreeDepth
    ],
    "Governance"
  )

  // deploy MTUtils
  const mtUtilsInstance = await deployAndRegister(
    deployer,
    MTUtilsContract,
    [ 
      ECVerifyLib,
      Types,
      paramManagerLib,
      rollupUtilsLib
    ],
    [
      nameRegistryInstance.address
    ],
    "MERKLE_UTILS"
  )

  // deploy logger
  const loggerInstance = await deployAndRegister(
    deployer,
    loggerContract,
    [],
    [],
    "LOGGER"
  )
  
  // deploy Token registry contract
  const tokenRegistryInstance = await deployAndRegister(
    deployer,
    tokenRegistryContract,
    [ 
      ECVerifyLib,
      Types,
      paramManagerLib,
      rollupUtilsLib
    ],
    [
      nameRegistryInstance.address
    ],
    "TOKEN_REGISTRY"
  )

  // deploy POB contract
  const pobInstance = await deployAndRegister(deployer, POBContract, [], [], "POB")
  
  // deploy account tree contract
  const accountsTreeInstance = await deployAndRegister(
    deployer,
    incrementalTreeContract,
    [paramManagerLib],
    [nameRegistryInstance.address],
    "ACCOUNTS_TREE"
  )
  
  // deploy test token
  const testTokenInstance = await deployAndRegister(
    deployer,
    testTokenContract,
    [],
    [],
    "TEST_TOKEN"
  )
  
  const root = await getMerkleRootWithCoordinatorAccount(max_depth);

  // deploy deposit manager
  const depositManagerInstance = await deployAndRegister(
    deployer,
    depositManagerContract,
    [
      Types,
      paramManagerLib,
      rollupUtilsLib
    ],
    [
      nameRegistryInstance.address
    ],
    "DEPOSIT_MANAGER"
  )

  // deploy Rollup core
  const rollupInstance = await deployAndRegister(
    deployer,
    rollupContract,
    [ 
      ECVerifyLib,
      Types,
      paramManagerLib,
      rollupUtilsLib
    ],
    [
      nameRegistryInstance.address,
      root
    ],
    "ROLLUP_CORE"
  )

  const contractAddresses = {
    AccountTree: accountsTreeInstance.address,
    ParamManager: paramManagerInstance.address,
    DepositManager: depositManagerInstance.address,
    RollupContract: rollupInstance.address,
    ProofOfBurnContract: pobInstance.address,
    RollupUtilities: rollupUtilsLib.address,
    NameRegistry: nameRegistryInstance.address,
    Logger: loggerInstance.address,
    MerkleTreeUtils: mtUtilsInstance.address,
  };

  writeContractAddresses(contractAddresses);
};

async function getMerkleRootWithCoordinatorAccount(maxSize) {
  // coordinator account
  var coordinator =
    "0x012893657d8eb2efad4de0a91bcd0e39ad9837745dec3ea923737ea803fc8e3d";
  var dataLeaves = [];
  dataLeaves[0] = coordinator;
  var numberOfDataLeaves = 2 ** maxSize;

  // create empty leaves
  for (var i = 1; i < numberOfDataLeaves; i++) {
    dataLeaves[i] =
      "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
  }

  // get deployed name registry instance
  var nameRegistryInstance = await nameRegistryContract.deployed();

  // get deployed parama manager instance
  var paramManagerInstance = await paramManagerLib.deployed();

  // get accounts tree key
  var merkleTreeUtilKey = await paramManagerInstance.MERKLE_UTILS();

  var merkleTreeUtilsAddr = await nameRegistryInstance.getContractDetails(
    merkleTreeUtilKey
  );

  MTUtilsInstance = await merkleTreeUtilsContract.at(merkleTreeUtilsAddr);
  var result = await MTUtilsInstance.getMerkleRootFromLeaves(dataLeaves);
  console.log("result", result);
  
  return result;
}

async function deployAndRegister(deployer, contract, libs, args, name) {
  var nameRegistryInstance = await nameRegistryContract.deployed();
  var paramManagerInstance = await paramManagerLib.deployed();

  for (let i = 0; i < libs.length; i++) {
    await deployer.link(libs[i], contract);
  }
  var contractInstance = await deployer.deploy(contract, ...args);
  await nameRegistryInstance.registerName(await paramManagerInstance[name](), contractInstance.address);
  return contractInstance;
}