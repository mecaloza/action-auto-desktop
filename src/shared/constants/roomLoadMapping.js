"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTROL_VALUES = exports.getRandomCDN = exports.CDN_DISTRIBUTIONS = exports.roomLoadMapping = void 0;
exports.roomLoadMapping = {
    savage: ['spots', 'mirros', 'sign', 'red_light', 'fans', 'white_light', 'blue_light', 'sound'],
    tonic: ['sign', 'pink_light', 'mirros', 'whitelight', 'sound'],
    solido: ['sign', 'pink_light', 'mirros', 'whitelight', 'sound'],
    jab: ['spots', 'mirros', 'sign', 'blue_light', 'strober', 'whitelight', 'sound', 'red_light'],
    stride: ['mirros', 'red_light', 'blue_light', 'sign', 'strober', 'laser', 'sound', 'whitelight'],
    giro: ['blue_light', 'mirros', 'sign', 'sound'],
    buum: ['mirros', 'robotic_light', 'blue_light', 'sound'],
    lestrois: ['blue_light', 'mirros', 'sound', 'warm_tibet'],
    beats: ['strober', 'sound', 'warm_light'],
    level: ['sign', 'pink_light', 'mirros', 'whitelight', 'sound'],
};
exports.CDN_DISTRIBUTIONS = [
    'https://d2pi1lsph7m4xz.cloudfront.net',
    'https://d3rug0yr92b85b.cloudfront.net',
    'https://dwazljzvyhd3l.cloudfront.net',
    'https://dhtacmdviug3h.cloudfront.net',
];
const getRandomCDN = () => {
    const randomIndex = Math.floor(Math.random() * exports.CDN_DISTRIBUTIONS.length);
    return exports.CDN_DISTRIBUTIONS[randomIndex];
};
exports.getRandomCDN = getRandomCDN;
exports.CONTROL_VALUES = {
    OFF: 0,
    ON: 1,
    AUTOMATIC: 8,
    MANUAL: 9,
};
