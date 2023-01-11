const crypto = await import("node:crypto");

async function getSignature(
  authToken: string,
  url: string,
  params: any
): Promise<string> {
  // get all request parameters
  const data = Object.keys(params)
    // sort them
    .sort()
    // concatenate them to a string
    .reduce((acc, key) => acc + key + params[key], url);

  return (
    crypto
      // sign the string with sha1 using your AuthToken
      .createHmac("sha1", authToken)
      .update(Buffer.from(data, "utf-8"))
      // base64 encode it
      .digest("base64")
  );
}

export { getSignature };
