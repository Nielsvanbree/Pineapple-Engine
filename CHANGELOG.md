# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2022-10-12

### Fixed
- Fixed typo in package.json exports: jois -> joi

## [1.2.0] - 2022-10-24

### Added
- To unpack a DynamoDB stream record and decode the newImage & oldImage, you can now use a Pineapple class instance. Simply invoke PineappleClassInstance.dynamodb.unpackStreamRecord(record). It will output the decoded newImage & oldImage and the non decoded rawNewImage & rawOldImage if they are part of the stream record. Unmarshalling of the record is also done by this Pineapple method.
- Exported interfaces DynamoDBStreamEvent, DynamoDBRecord and AttributeValue inside the dynamodb helper to help you with your stream handling in a TypeScript environment.

## [1.1.2] - 2022-10-12

### Fixed
- If you wanted to use updatedAt, updatedBy, createdAt or createdBy in the gsiSk1 they were being left out. With this fix it's possible to use these attributes inside the gsiSk1 as well.

## [1.1.1] - 2022-10-12

### Added
- Made helpers available (dynamodb, joi and utils) through /helpers/{{helperName}}
  - Utils exports <i>isValidUlid and addNewVersion</i>
  - Joi exports <i>j, metaInfoSchema, validate, prefixedUuid and prefixedUlid</i>
  - Dynamodb exports <i>get, dynamoGetPineapple, update, put, dynamoUpdatePineapple, query, unpackStreamRecord, translateStreamImage, stripDynamoObject, QueryCommandInput, UpdateCommandInput</i>

### Fixed
- AddNewVersion util joi validation now accepts unknown keys

## [1.1.0] - 2022-10-12

### Added
- Updated readme with all changes and additions
- Added joi as a peer dependency
- Added translateStreamImage to unmarshall a DynamoDB object into a JavaScript object from inside your DynamoDB stream function

### Changed
- Changed the individual function parameters for an options object for the get, list and update functions. <b>This is a breaking change!</b> From now on these functions will be easier to maintain backwards compatibility when changes are made. It's also more readable when you write your code.
- Added joi validation to all interfacing inputs, including all options. Especially useful for people using JavaScript. This should make it clearer why your input was malformed.
- Some smaller changes and improvements.

## [1.0.0] - 2022-10-04

### Added
- Pineapple Engine released publically!
- Pineapple DynamoDB interface functions: get, list & update, each with some options
- Example set & readme with explanations + guidelines
- Joi validation on your input at the interface level