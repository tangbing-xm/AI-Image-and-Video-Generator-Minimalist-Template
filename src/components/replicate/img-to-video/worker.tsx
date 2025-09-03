"use client";

import React, { useEffect, useState } from "react";
import { Button, CircularProgress, Switch } from "@nextui-org/react";
import Prediction from "@/backend/type/domain/replicate";
import { useAppContext } from "@/contexts/app";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { UserSubscriptionInfo } from "@/backend/type/domain/user_subscription_info";
import DeleteButton from "@/components/button/delete-button";
import { handleApiErrors } from "@/components/replicate/common-logic/response";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import CreditInfo from "@/components/landingpage/credit-info";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Worker(props: {
  lang: string;
  credit: number;
  prompt: string;
  model: string;
  version: string;
  effect_link_name: string;
  promotion: string;
  defaultMode: string;
  showMode: boolean;
}) {
  const t = useTranslations(props.lang);
  const [prompt, setPrompt] = useState(props.prompt);
  const [generating, setGenerating] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [userSubscriptionInfo, setUserSubscriptionInfo] =
    useState<UserSubscriptionInfo | null>(null);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [images, setImages] = useState<{
    left: string | null;
    right: string | null;
    one: string | null;
  }>({
    left: null,
    right: null,
    one: null,
  });
  const [uploadMode, setUploadMode] = useState<"single" | "double">(
    props.defaultMode as "single" | "double"
  );
  const { user } = useAppContext();
  const [mergedPreview, setMergedPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uuid) {
      fetchUserSubscriptionInfo();
    }
  }, [user?.uuid]);

  const fetchUserSubscriptionInfo = async () => {
    if (!user?.uuid) return;
    const userSubscriptionInfo = await fetch(
      "/api/user/get_user_subscription_info",
      {
        method: "POST",
        body: JSON.stringify({ user_id: user.uuid }),
      }
    ).then((res) => {
      if (!res.ok) throw new Error("Failed to fetch user subscription info");
      return res.json();
    });
    setUserSubscriptionInfo(userSubscriptionInfo);
    setIsSubscribed(userSubscriptionInfo.subscription_status === "active");
  };

  const mergeImages = async (): Promise<File | null> => {
    if (uploadMode === "single" && !images.one) {
      toast.warning("Please upload a photo");
      return null;
    }
    if (uploadMode === "double" && (!images.left || !images.right)) {
      toast.warning("Please upload both photos");
      return null;
    }
    // If single mode or only one image, convert base64 to File
    if (uploadMode === "single" && images.one) {
      const response = await fetch(images.one);
      const blob = await response.blob();
      return new File([blob], "input.jpg", { type: "image/jpeg" });
    }

    // Create canvas for merging images
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Create image elements
    const leftImg = new Image();
    const rightImg = new Image();

    try {
      // Wait for both images to load
      await Promise.all([
        new Promise((resolve, reject) => {
          leftImg.onload = resolve;
          leftImg.onerror = reject;
          leftImg.src = images.left!;
        }),
        new Promise((resolve, reject) => {
          rightImg.onload = resolve;
          rightImg.onerror = reject;
          rightImg.src = images.right!;
        }),
      ]);

      // Calculate target height - use the smaller height
      const targetHeight = Math.min(leftImg.height, rightImg.height);

      // Calculate scaled widths maintaining aspect ratio
      const leftScaledWidth = (leftImg.width * targetHeight) / leftImg.height;
      const rightScaledWidth =
        (rightImg.width * targetHeight) / rightImg.height;

      // Set canvas dimensions
      canvas.width = leftScaledWidth + rightScaledWidth;
      canvas.height = targetHeight;

      // Draw scaled images
      ctx.drawImage(leftImg, 0, 0, leftScaledWidth, targetHeight);
      ctx.drawImage(
        rightImg,
        leftScaledWidth,
        0,
        rightScaledWidth,
        targetHeight
      );

      // Convert canvas to blob and then to File
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((blob) => resolve(blob!), "image/jpeg")
      );

      return new File([blob], "merged.jpg", { type: "image/jpeg" });
    } catch (error) {
      console.error("Error merging images:", error);
      return null;
    }
  };

  const handleGenerate = async () => {
    let newPrediction: Prediction;
    if (props.credit > 0) {
      if (
        typeof userSubscriptionInfo?.remain_count === "number" &&
        userSubscriptionInfo.remain_count < props.credit
      ) {
        toast.warning("No credit left");
        return;
      }
    }

    if (user === undefined || user === null) {
      toast.warning("Please login first");
      await sleep(1000);
      signIn("google");
      return;
    }

    // step1: create prediction
    try {
      setGenerating(true);
      setError(null);

      // Get merged image file
      const imageFile = await mergeImages();
      if (imageFile === null) {
        setGenerating(false);
        return;
      }
      if (!imageFile) {
        throw new Error("Failed to process images");
      }

      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("model", props.model);
      formData.append("user_id", user?.uuid || "");
      formData.append("user_email", user?.email || "");
      formData.append("effect_link_name", props.effect_link_name);
      formData.append("prompt", prompt);
      formData.append("credit", props.credit.toString());

      if (prompt === "" || prompt === null || prompt === undefined) {
        toast.warning("Please enter a prompt");
        setGenerating(false);
        return;
      }
      const response = await fetch("/api/predictions/img_to_video", {
        method: "POST",
        body: formData,
      });

      // Read response.json() only once and store result
      newPrediction = await response.json();
      const canContinue = await handleApiErrors({
        response,
        newPrediction,
        router,
      });
      if (!canContinue) {
        setGenerating(false);
        return;
      }
      setPrediction(newPrediction);
    } catch (error) {
      console.error("Error occurred, please try again", error);
      toast.error("An error occurred, please try again");
      setGenerating(false);
      return;
    }

    // step2: wait for prediction to be succeeded or failed
    while (
      newPrediction.status !== "succeeded" &&
      newPrediction.status !== "failed"
    ) {
      await sleep(5000);
      const response = await fetch("/api/predictions/" + newPrediction.id);
      newPrediction = await response.json();
      if (response.status !== 200) {
        setError(newPrediction.detail);
        return;
      }
      setPrediction(newPrediction);
    }

    // update effect result
    const runningTime =
      (newPrediction.created_at
        ? new Date().getTime() - new Date(newPrediction.created_at).getTime()
        : -1) / 1000;
    fetch("/api/effect_result/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        original_id: newPrediction.id,
        status: newPrediction.status,
        running_time: runningTime,
        updated_at: new Date(),
        original_image_url: "", // : webhook will update this
        object_key: newPrediction.id, // : webhook will update this
      }),
    });
    await sleep(4000);
    setGenerating(false);
    fetchUserSubscriptionInfo();
  };

  const handleImageUpload =
    (side: "left" | "right" | "one") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages((prev) => ({
            ...prev,
            [side]: reader.result as string,
          }));
        };
        reader.readAsDataURL(file);
      }
    };

  const handleDeleteImage = (side: "left" | "right" | "one") => {
    setImages((prev) => ({
      ...prev,
      [side]: null,
    }));
  };

  const generateMergedPreview = async () => {
    if (uploadMode === "double" && images.left && images.right) {
      const mergedFile = await mergeImages();
      if (mergedFile) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setMergedPreview(reader.result as string);
        };
        reader.readAsDataURL(mergedFile);
      }
    }
  };

  useEffect(() => {
    if (uploadMode === "double" && images.left && images.right) {
      generateMergedPreview();
    } else {
      setMergedPreview(null);
    }
  }, [images.left, images.right, uploadMode]);

  return (
    <>
      <div
        className="container mx-auto flex flex-col md:flex-row my-4 px-4 py-8 border-1 border-blue-200 rounded-lg shadow-lg shadow-blue-200 bg-white"
        style={{
          boxShadow:
            "0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(59, 130, 246, 0.1)",
        }}
      >
        <div className="w-full md:w-1/2 md:px-6 md:border-r border-divider border-default-300">
          {/* Upload Controls */}
          <div className="">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                {t("input.title")}
              </h2>
              <div className="flex items-center gap-3">
                <CreditInfo
                  credit={userSubscriptionInfo?.remain_count?.toString() || ""}
                />
                {props.showMode && (
                  <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-full">
                    <span className="text-sm text-gray-600">
                      {t("input.mode")}
                    </span>

                    <Switch
                      checked={uploadMode === "double"}
                      onChange={() =>
                        setUploadMode(
                          uploadMode === "double" ? "single" : "double"
                        )
                      }
                      className="data-[state=checked]:bg-indigo-600"
                    />
                  </div>
                )}
              </div>
            </div>

            {uploadMode === "double" ? (
              <div className="flex flex-col items-center justify-center w-full">
                <div className="flex flex-row items-center justify-center w-full gap-4">
                  {/* Left Image Upload */}
                  <div className="flex flex-col w-full items-center justify-center">
                    <p className="mb-2 text-sm font-medium text-gray-700">
                      {t("input.left-photo")}
                    </p>
                    <label className="relative flex flex-col items-center justify-center w-full h-64 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-100 transition duration-300">
                      {images.left ? (
                        <div className="relative w-full h-full">
                          <img
                            src={images.left}
                            alt="Left"
                            className="h-full w-full object-contain rounded-lg"
                          />
                          <DeleteButton
                            onClick={() => handleDeleteImage("left")}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center p-4">
                          <svg
                            className="w-12 h-12 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            />
                          </svg>
                          <span className="mt-2 text-sm text-gray-500">
                            {t("input.upload-tips")}
                          </span>
                        </div>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleImageUpload("left")}
                        accept="image/*"
                      />
                    </label>
                  </div>

                  {/* Right Image Upload */}
                  <div className="flex flex-col w-full items-center justify-center">
                    <p className="mb-2 text-sm font-medium text-gray-700">
                      {t("input.right-photo")}
                    </p>
                    <label className="relative flex flex-col items-center justify-center w-full h-64 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-100 transition duration-300">
                      {images.right ? (
                        <div className="relative w-full h-full">
                          <img
                            src={images.right}
                            alt="Right"
                            className="h-full w-full object-contain rounded-lg"
                          />
                          <DeleteButton
                            onClick={() => handleDeleteImage("right")}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center p-4">
                          <svg
                            className="w-12 h-12 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            />
                          </svg>
                          <span className="mt-2 text-sm text-gray-500">
                            {t("input.upload-tips")}
                          </span>
                        </div>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleImageUpload("right")}
                        accept="image/*"
                      />
                    </label>
                  </div>
                </div>
                {uploadMode === "double" && mergedPreview && (
                  <div className="flex flex-col items-center justify-center mt-6">
                    <p className="mb-2 text-sm font-medium text-gray-700">
                      {t("input.merged-preview")}
                    </p>
                    <div className="relative w-full h-64">
                      <img
                        src={mergedPreview}
                        alt="Merged Preview"
                        className="h-full w-full object-contain rounded-lg border-2 border-gray-300"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Single Image Upload */
              <div>
                {props.showMode && (
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    {t("input.couple-photo")}
                  </p>
                )}
                <label className="relative flex flex-col items-center justify-center h-64 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-100 transition duration-300">
                  {images.one ? (
                    <div className="relative w-full h-full">
                      <img
                        src={images.one}
                        alt="one"
                        className="h-full w-full object-contain rounded-lg"
                      />
                      <DeleteButton onClick={() => handleDeleteImage("one")} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center p-4">
                      <svg
                        className="w-12 h-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      <span className="mt-2 text-sm text-gray-500">
                        {t("input.upload-tips")}
                      </span>
                    </div>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleImageUpload("one")}
                    accept="image/*"
                  />
                </label>
              </div>
            )}

            {/* Prompt Input */}
            <div className="mt-6">
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
                placeholder={t("input.promptTips")}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
            </div>

            {/* Generate Button */}
            {generating ? (
              <Button
                isLoading
                className="w-full mt-4 bg-blue-600 text-white hover:bg-blue-700 transition duration-200"
              >
                {prediction
                  ? prediction.status === "succeeded"
                    ? "Processing..."
                    : prediction.status
                  : "Processing..."}
              </Button>
            ) : (
              <Button
                className="w-full mt-4 bg-blue-600 text-white hover:bg-blue-700 transition duration-200"
                onClick={handleGenerate}
              >
                {t("input.createButton")} ( credit: {props.credit} )
              </Button>
            )}
          </div>
        </div>

        {/* output */}
        <div className="flex w-full md:w-1/2 px-4 mt-8 md:mt-0">
          {error && (
            <div className="flex justify-center items-center text-red-500">
              {error}
            </div>
          )}
          {prediction ? (
            <>
              {prediction.output ? (
                <div className="flex justify-center items-center relative group rounded-lg">
                  <video
                    src={prediction.output}
                    className="flex justify-center items-center w-auto h-auto rounded-lg"
                    controls
                  />
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      className="bg-black text-white"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = prediction.output || "";
                        link.setAttribute("download", "");
                        link.setAttribute("target", "_blank");
                        link.click();
                      }}
                    >
                      {t("output.downloadButton")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full w-full bg-gray-200 border-2 border-dashed animate-pulse rounded-lg">
                  <CircularProgress
                    color="primary"
                    aria-label="Loading..."
                    classNames={{
                      svg: "text-indigo-600",
                    }}
                  />
                  <span className="text-indigo-600 font-semibold mb-2">
                    {prediction.status}
                  </span>
                  <span className="text-indigo-600 font-semibold">
                    please wait for about two to three minutes.
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="hidden md:flex items-center md:px-4 justify-center w-full h-full border-2 border-dashed  rounded-lg">
              <video
                src={props.promotion}
                className="flex justify-center items-center w-auto h-full rounded-lg pb-7"
                loop
                autoPlay
                muted
                playsInline
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
