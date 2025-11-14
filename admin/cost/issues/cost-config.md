Here is an issue with the way cost tracking is configured in the config file and validated by the config validator for cost tracking.

Specifically, we set up the validation in the config format to Specify token pricing for models using a model string as the key. The model string is currently the provider plus a comma plus the model name.  But it turns out the way the models are specified in the requests that we need to process to get the token usage counts from are just the model name and don't include the provider.

This means that we need to change our config schema and the validator so that the key or a model is just the model name and doesn't include the provider name or the comma.

It's not impossible that we would have the same model name from two different providers, but that's okay. We will only have one pricing configuration for that model, regardless of which provider is being used. It will be up to the user to choose the price for their workflow to get the most meaning in the case that two different providers have different pricing.

Right now this means we need to change the config format, the typescript type definitions, the validator logic, and update the current user config where my user.

Look through the code and see how this is currently being handled in a formulated plan to address this.

Document this tip for testing. There are currently console logs to help test a live Claude code session using the Claude code router server.

In one shell, build and retstart the server.  This will restart the server in the foreground where you can monitor console logs:

```bash
pnpm build && dist/cli.js restart
```

In another shell, start the code session.  We'll start an interactive code session. I think this has to be done manually. I'm not aware of a way to automate it. At least one prompt must be submitted to cause traffic to then monitor the logs from the server...:

```bash
dist/cli.js code
```