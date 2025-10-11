"use strict";
// Dataset Search Request/Response Types
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetSearchError = void 0;
class DatasetSearchError extends Error {
    constructor(message, code = 'DATASET_SEARCH_ERROR', statusCode = 500) {
        super(message);
        this.name = 'DatasetSearchError';
        this.code = code;
        this.statusCode = statusCode;
    }
}
exports.DatasetSearchError = DatasetSearchError;
//# sourceMappingURL=DatasetSearchTypes.js.map