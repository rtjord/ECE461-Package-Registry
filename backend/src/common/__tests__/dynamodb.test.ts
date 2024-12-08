import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
    clearDynamoDBTable,
    getPackageById,
    getPackageByName,
    getPackageHistory,
    updatePackageHistory,
    uploadPackageMetadata
} from "../dynamodb";
import { PackageID, User, PackageTableRow, PackageMetadata } from "../interfaces"; // Replace with actual interfaces path
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";

describe("DynamoDB Functions", () => {
    let dynamoDBClient: DynamoDBDocumentClient;

    const testPackageId: PackageID = "test-package-id";
    const testPackageName = "test-package";
    const testPackageRow: PackageTableRow = {
        ID: testPackageId,
        PackageName: testPackageName,
        Version: "1.0.0",
        standaloneCost: 0.0,
    };
    const testPackageMetadata: PackageMetadata = {
        Name: testPackageName,
        Version: "1.0.0",
        ID: testPackageId,
    };

    const testUser: User = { name: "test-user", isAdmin: true };
    beforeAll(async () => {
        const client = new DynamoDBClient({ region: "us-east-2", credentials: fromIni({ profile: "dev" }) });
        dynamoDBClient = DynamoDBDocumentClient.from(client);
        await clearDynamoDBTable(dynamoDBClient, "PackageMetadata", (item) => ({ ID: item.ID }));
        await clearDynamoDBTable(dynamoDBClient, "PackageHistoryTable", (item) => ({
            PackageName: item.PackageName,
            Date: item.Date,
        }));
        await uploadPackageMetadata(dynamoDBClient, testPackageRow);
    });

    test("getPackageById should retrieve a package by ID", async () => {
        const result = await getPackageById(dynamoDBClient, testPackageId);
        expect(result).toEqual(testPackageRow);
    });

    test("getPackageByName should retrieve packages by name", async () => {
        const result = await getPackageByName(dynamoDBClient, testPackageName);
        console.log(result);
        expect(result).toEqual([
            testPackageMetadata,
        ]);
    });

    test("getPackageHistory should return an empty package history", async () => {
        const result = await getPackageHistory(dynamoDBClient, testPackageName);
        expect(result).toEqual([]);
    });

    test("updatePackageHistory should add a new history entry", async () => {
        const newAction = "UPDATE";
        await updatePackageHistory(dynamoDBClient, testPackageName, "1.0.1", testPackageId, testUser, newAction);

        const result = await getPackageHistory(dynamoDBClient, testPackageName);
        expect(result).toHaveLength(1);
        expect(result[0].PackageMetadata).toEqual({
            Name: testPackageName,
            Version: "1.0.1",
            ID: testPackageId,
        });
        expect(result[0].Date).toBeDefined();
        expect(result[0].User).toEqual(testUser);
        expect(result[0].Action).toEqual(newAction);
        console.log(result);
    });

    test("uploadPackageMetadata should add a new package metadata entry", async () => {
        const newMetadata: PackageTableRow = { ID: "new-id", PackageName: "new-package", Version: "1.0.0", standaloneCost: 0.0 };
        await uploadPackageMetadata(dynamoDBClient, newMetadata);

        const result = await getPackageById(dynamoDBClient, "new-id");
        expect(result).toEqual(newMetadata);
    });

    afterAll(async () => {
        // Clean up any data inserted for the tests
        await clearDynamoDBTable(dynamoDBClient, "PackageMetadata", (item) => ({ ID: item.ID }));
    });
});
