const path = require("path");
const fs = require("fs");

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf-8");
  raw.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = (match[2] || "").trim();
    }
  });
}

async function checkProjects() {
  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;

  // Get IAM token
  const params = new URLSearchParams();
  params.append("grant_type", "urn:ibm:params:oauth:grant-type:apikey");
  params.append("apikey", apiKey);

  const iamRes = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const { access_token } = await iamRes.json();

  // Test across common watsonx regions
  const regions = [
    "https://us-south.ml.cloud.ibm.com",
    "https://us-east.ml.cloud.ibm.com",
    "https://eu-de.ml.cloud.ibm.com",
    "https://eu-gb.ml.cloud.ibm.com",
    "https://jp-tok.ml.cloud.ibm.com",
    "https://ca-tor.ml.cloud.ibm.com",
    "https://au-syd.ml.cloud.ibm.com",
  ];

  console.log(`Checking project ${projectId} across regions...`);
  for (const url of regions) {
    try {
      const res = await fetch(`${url}/ml/v1/text/generation?version=2023-05-29`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          input: "Hello",
          model_id: "ibm/granite-3-8b-instruct",
          project_id: projectId,
          parameters: { max_new_tokens: 10 },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`✅ FOUND & WORKING in region: ${url}`);
        console.log("Sample response:", data.results?.[0]?.generated_text?.trim());
        return url;
      } else {
        const err = await res.json().catch(() => ({}));
        console.log(`❌ ${url} -> status ${res.status}: ${err?.errors?.[0]?.message || res.statusText}`);
      }
    } catch (e) {
      console.log(`❌ ${url} -> error: ${e.message}`);
    }
  }
}

checkProjects();
