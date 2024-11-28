import aws4 from "aws4";
import axios from "axios";
import { defaultProvider } from "@aws-sdk/credential-provider-node";

export async function clearDomain(domainEndpoint: string) {
    const credentials = await defaultProvider()();
    const request = {
        host: domainEndpoint.replace(/^https?:\/\//, ""),
        path: "/_all",
        service: "es",
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
    };

    aws4.sign(request, credentials);

    console.log("Deleting all indices from domain:", domainEndpoint);
    try {
        const response = await axios({
            method: request.method,
            url: `https://${request.host}${request.path}`,
            headers: request.headers,
        });
        // await createReadmeIndex(domainEndpoint);
        console.log("All indices deleted:", response.data);
    } catch (error) {
        console.error("Error deleting indices:", error);

    }
}