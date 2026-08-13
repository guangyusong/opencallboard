# Shared transactional email foundation

This directory provisions one reusable Amazon SES foundation and one isolated
sender identity per product. Applications can run outside AWS; OpenCallboard
signs SES v2 requests directly from its Cloudflare Worker.

## Architecture

- `transactional-email-foundation.yaml` creates the shared SES configuration
  set, account-level bounce/complaint suppression, encrypted SNS feedback topic,
  and SES event destination.
- `transactional-email-product.yaml` creates one verified domain identity,
  custom MAIL FROM domain, and a least-privileged IAM sender for one product.
- Each product gets a different IAM user and secret. Its policy can send only
  from the verified product domain and only through the shared configuration
  set.
- Provider secrets belong in the deployment platform's encrypted secret store.
  They must never be committed or placed in ordinary Worker variables.

## Provision the shared layer once

```sh
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name shared-transactional-email-foundation \
  --template-file infra/aws/transactional-email-foundation.yaml \
  --capabilities CAPABILITY_NAMED_IAM
```

## Onboard a product

```sh
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name example-product-transactional-email \
  --template-file infra/aws/transactional-email-product.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProductName=example-product \
    DomainName=example.com \
    MailFromSubdomain=mail \
    ConfigurationSetName=shared-transactional
```

Then:

1. Publish the three Easy DKIM CNAME records returned by SES.
2. Publish the custom MAIL FROM MX and SPF records.
3. Publish DMARC in monitoring mode first, then tighten it after delivery is
   proven.
4. Create one access key for the product sender and put it directly into the
   target platform's encrypted secrets. Do not print or persist the secret.
5. Configure the application with the SES region, configuration set, and a
   sender address under the verified domain.
6. Send one approved synthetic canary, verify the provider message ID, then
   inspect bounce/complaint metrics before opening broader delivery.

For the OpenCallboard Worker the encrypted bindings are
`CALLBOARD_SES_ACCESS_KEY_ID` and `CALLBOARD_SES_SECRET_ACCESS_KEY`. The region
and configuration-set name are ordinary non-secret variables.

## Rotation and rollback

Rotate a sender without downtime by creating a second key, updating the target
secret store, proving one canary, and then deleting the old key. A product can be
stopped immediately by disabling its IAM access key or setting the SES
configuration set's sending option to disabled. Removing the product stack
deletes only that product's identity and sender; it does not affect other SaaS
products using the shared foundation.

Deleting the shared foundation is a last resort because it removes feedback
monitoring for every enrolled product. Preserve the encrypted feedback topic if
retention or incident-review requirements apply.

## Operational boundary

SES delivery is at-least-once from the application's queue boundary. Every
application must maintain its own durable outbox/idempotency record, use
single-use authentication tokens, suppress invalid destinations, and treat
bounces and complaints as operational signals rather than retryable transport
errors.
