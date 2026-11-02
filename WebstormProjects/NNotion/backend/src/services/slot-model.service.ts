import { existsSync, readFileSync } from "fs";
import path from "path";
import {
    roundScore,
    slotModelFeatureNames,
    SlotModelFeatures,
} from "./slot-feature.utils";

export type SlotModelWeights = {
    version: number;
    features: string[];
    bias: number;
    weights: Record<keyof SlotModelFeatures, number>;
    trainedAt: string | null;
    samples: number;
    learningRate?: number;
    epochs?: number;
    loss?: number;
};

export const slotModelWeightsPath = path.resolve(process.cwd(), "ml", "slot-model-weights.json");

export const defaultSlotModelWeights: SlotModelWeights = {
    version: 1,
    features: [...slotModelFeatureNames],
    bias: -1.1,
    weights: {
        votesShare: 1.4,
        teacherAvailable: 0.55,
        groupAvailable: 0.35,
        convenience: 0.7,
        normalizedDayOfWeek: 0.25,
        normalizedStartHour: -0.15,
    },
    trainedAt: null,
    samples: 0,
};

export class SlotModelService {
    constructor(private readonly weightsFilePath = slotModelWeightsPath) {}

    predict(features: SlotModelFeatures) {
        const model = this.loadWeights();
        const z = slotModelFeatureNames.reduce(
            (sum, featureName) => sum + model.weights[featureName] * features[featureName],
            model.bias
        );

        return roundScore(1 / (1 + Math.exp(-z)));
    }

    loadWeights(): SlotModelWeights {
        if (!existsSync(this.weightsFilePath)) {
            return defaultSlotModelWeights;
        }

        try {
            const parsed = JSON.parse(readFileSync(this.weightsFilePath, "utf8")) as Partial<SlotModelWeights>;

            return {
                ...defaultSlotModelWeights,
                ...parsed,
                weights: {
                    ...defaultSlotModelWeights.weights,
                    ...(parsed.weights ?? {}),
                },
                features: [...slotModelFeatureNames],
            };
        } catch {
            return defaultSlotModelWeights;
        }
    }

    getModelInfo() {
        const weights = this.loadWeights();

        return {
            type: "sigmoid",
            formula: "sigmoid(w1*x1 + w2*x2 + ... + b)",
            features: weights.features,
            weights: weights.weights,
            bias: weights.bias,
            trainedAt: weights.trainedAt,
            samples: weights.samples,
            source: existsSync(this.weightsFilePath) ? this.weightsFilePath : "default",
        };
    }
}
