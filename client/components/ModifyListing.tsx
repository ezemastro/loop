import { useEffect, useState, type JSX } from "react";
import { View, Text, FlatList, TextInput, Pressable } from "react-native";
import { twMerge } from "tailwind-merge";
import {
  MAX_LISTING_DESCRIPTION_LENGTH,
  MAX_LISTING_TITLE_LENGTH,
  PRICE_STATUS_MULTIPLIERS,
  PRODUCT_STATUSES,
} from "@/config";
import CategorySelector from "./selectors/CategorySelector";
import ProductStatusSelector from "./selectors/ProductStatusSelector";
import CustomButton from "./bases/CustomButton";
import ButtonText from "./bases/ButtonText";
import { usePublishListing } from "@/hooks/usePublishListing";
import { validatePublishListingForm } from "@/services/validations";
import Error from "./Error";
import { BackIcon, CreditIcon } from "./Icons";
import { formatNumber } from "@/utils/formatNumber";
import { useRouter } from "expo-router";
import { useUploadFiles } from "@/hooks/useUploadFiles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUpdateListing } from "@/hooks/useUpdateListing";
import { useQueryClient } from "@tanstack/react-query";
import CustomRefresh from "./CustomRefresh";
import AvoidingKeyboard from "./AvoidingKeyboard";
import Loader from "./Loader";
import ImagesSelector from "./selectors/ImagesSelector";
import { MainView, pageContentClassName } from "@/components/bases/MainView";
import { useThemeColors } from "@/hooks/useThemeColors";

interface Field {
  key: string;
  title?: string;
  isError: boolean;
  /**
   * Extra bottom margin below the field, preserved from the original per-field spacing (Images,
   * Category and Product Status carried their own `mb-4`; Title, Description and Price did not).
   * Kept as a per-field override rather than a uniform row gap so wide-screen pairing doesn't
   * change mobile spacing.
   */
  spacingClassName?: string;
  component: () => JSX.Element;
}
/**
 * A `Row` holds one field (always full width) or two fields (paired side by side from `md` up,
 * stacked full width on mobile — see `renderItem` below). Grouping stays adjacent to the
 * original field order so mobile requires zero reordering.
 */
interface Row {
  key: string;
  fields: Field[];
}
interface FormMedia {
  uri?: string;
  type?: string;
  id?: UUID;
}
interface FormData {
  title: string | null;
  description: string | null;
  images: FormMedia[];
  category: Category | null;
  productStatus: ProductStatus | null;
  price: number | null;
}

export default function ModifyListing({
  backButton = false,
  initialData = null,
  action,
}: {
  backButton?: boolean;
  initialData?: Listing | null;
  action: "edit" | "create";
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  // A form column does not benefit from the full "wide" page cap (1400px) — the narrower page
  // tier keeps fields readable while still leaving room for the md+ side-by-side pairs below.
  const contentContainerClassName = pageContentClassName("narrow", "gap-2");

  const [form, setForm] = useState<FormData>({
    title: initialData?.title || null,
    description: initialData?.description || null,
    images: initialData?.media || [],
    category: initialData?.category || null,
    productStatus: initialData?.productStatus || null,
    price: initialData?.price || null,
  });
  const [errors, setErrors] = useState<Record<keyof FormData, boolean>>({
    title: false,
    description: false,
    images: false,
    category: false,
    productStatus: false,
    price: false,
  });
  const {
    mutate: publishListing,
    isSuccess: isPublishSuccess,
    isError: isPublishListingError,
    data: listingData,
    isPending: isPublishingListing,
  } = usePublishListing();
  const {
    mutate: updateListing,
    isSuccess: isUpdateSuccess,
    isError: isUpdateListingError,
    isPending: isUpdatingListing,
  } = useUpdateListing();
  const {
    mutate: uploadFiles,
    isError: isUploadFilesError,
    isPending: isUploadingFiles,
  } = useUploadFiles();

  useEffect(() => {
    if ((isPublishSuccess && listingData?.listing?.id) || (isUpdateSuccess && initialData?.id)) {
      if (action === "create") {
        router.replace({
          pathname: "/listing/[listingId]",
          params: {
            listingId: listingData?.listing?.id!,
          },
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["listings"], exact: false });
        queryClient.invalidateQueries({
          queryKey: ["listing", initialData?.id],
        });
        router.back();
      }
    }
  }, [isPublishSuccess, isUpdateSuccess, router, listingData, initialData, action, queryClient]);

  const handleSubmit = async () => {
    // Validaciones
    const publishListingForm = {
      title: form.title,
      description: form.description,
      categoryId: form.category?.id,
      productStatus: form.productStatus,
      price: form.price,
    };
    const validation = await validatePublishListingForm(publishListingForm);
    let newErrors = {
      title: false,
      description: false,
      images: false,
      category: false,
      productStatus: false,
      price: false,
    };
    if (!validation.success) {
      validation.error?.issues.forEach((issue) => {
        let path = issue.path[0];
        if (path === "categoryId") path = "category";
        newErrors[path as keyof FormData] = true;
      });
    }
    if (form.images.length === 0) {
      newErrors.images = true;
    }
    setErrors(newErrors);
    if (Object.values(newErrors).some((error) => error)) {
      return;
    }

    // Subir imágenes
    uploadFiles(
      form.images
        .filter((image) => !image.id)
        .map((image) => ({ uri: image.uri!, type: image.type! })),
      {
        onSuccess: (results) => {
          let c = 0;
          const medias = form.images.map((image) => {
            if (image.id) return image;
            c++;
            return results[c - 1]?.media!;
          });
          setForm((prev) => ({ ...prev, images: medias }));
          const body = {
            title: form.title!,
            description: form.description,
            mediaIds: medias.map((media) => media.id!),
            categoryId: form.category!.id,
            productStatus: form.productStatus!,
            price: form.price!,
          };
          // Publicar
          if (action === "create") {
            publishListing(body);
          } else if (action === "edit") {
            // Actualizar
            updateListing({
              ...body,
              listingId: initialData?.id!,
            });
          }
        },
      },
    );
  };
  const handleImageChange = (images: FormMedia[]) => {
    setForm((prev) => ({ ...prev, images }));
  };
  const priceMultiplier = form.productStatus
    ? (PRICE_STATUS_MULTIPLIERS[form.productStatus] ?? 1)
    : 1;
  const adjustedPriceMin =
    form.category?.price?.min != null
      ? Math.round(form.category.price.min * priceMultiplier)
      : null;
  const adjustedPriceMax =
    form.category?.price?.max != null
      ? Math.round(form.category.price.max * priceMultiplier)
      : null;
  const imagesField: Field = {
    key: "Images",
    isError: errors.images,
    spacingClassName: "mb-4",
    component: () => (
      <ImagesSelector onChange={handleImageChange} initialImages={initialData?.media} />
    ),
  };
  const categoryField: Field = {
    key: "category",
    title: "Categoría",
    isError: errors.category,
    spacingClassName: "mb-4",
    component: () => (
      <CategorySelector
        value={form.category}
        onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
        className="bg-secondary-text/10 border-0 border-b border-gray-300 rounded-b-none rounded-t"
        placeholderClassName="text-secondary-text"
      />
    ),
  };
  const titleField: Field = {
    key: "Title",
    title: "Título",
    isError: errors.title,
    component: () => (
      <>
        <TextInput
          value={form.title || ""}
          onChangeText={(text) => {
            if (text.length > MAX_LISTING_TITLE_LENGTH) return;
            setForm((prev) => ({ ...prev, title: text }));
          }}
          placeholder="Escribe un título para tu publicación"
          placeholderTextColor={colors.SECONDARY_TEXT}
          className="w-full border-b border-gray-300 p-2 px-3 text-lg bg-secondary-text/10 rounded-t"
          underlineColorAndroid="#fff0"
          placeholderClassName="text-secondary-text"
        />
        <Text className="mt-1 text-right text-sm text-secondary-text">
          {form.title && form.title?.length > MAX_LISTING_TITLE_LENGTH - 10
            ? `${form.title.length}/${MAX_LISTING_TITLE_LENGTH}`
            : ""}
        </Text>
      </>
    ),
  };
  const descriptionField: Field = {
    key: "Description",
    title: "Descripción",
    isError: errors.description,
    component: () => (
      <>
        <TextInput
          value={form.description || ""}
          onChangeText={(text) => {
            if (text.length > MAX_LISTING_DESCRIPTION_LENGTH) return;
            // const cleanedText = text
            //   .replace(/\s+/g, " ")
            //   .replace(/(\n){2,}/g, "\n");
            setForm((prev) => ({ ...prev, description: text }));
          }}
          placeholder="Escribe una descripción para tu publicación"
          placeholderTextColor={colors.SECONDARY_TEXT}
          className="w-full border-b border-gray-300 p-2 px-3 text-lg bg-secondary-text/10 rounded-t"
          placeholderClassName="text-secondary-text"
          underlineColorAndroid="#fff0"
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
        <Text className="mt-1 text-right text-sm text-secondary-text">
          {form.description && form.description?.length > MAX_LISTING_DESCRIPTION_LENGTH - 50
            ? `${form.description.length}/${MAX_LISTING_DESCRIPTION_LENGTH}`
            : ""}
        </Text>
      </>
    ),
  };
  const productStatusField: Field = {
    key: "productStatus",
    title: "Estado",
    isError: errors.productStatus,
    spacingClassName: "mb-4",
    component: () => (
      <ProductStatusSelector
        value={form.productStatus}
        onChange={(value) => setForm((prev) => ({ ...prev, productStatus: value }))}
        className="bg-secondary-text/10 border-b border-gray-300 rounded-b-none rounded-t"
      />
    ),
  };
  const priceField: Field = {
    key: "price",
    title: "Precio",
    isError: errors.price,
    component: () => (
      <>
        <View className="flex-row gap-2 items-center border-b border-gray-300 bg-secondary-text/10 px-4 rounded-t">
          <CreditIcon size={32} />
          <TextInput
            value={form.price ? formatNumber(form.price) : ""}
            keyboardType="numeric"
            onChangeText={(text) => {
              const number = Number(text.replace(/[.,]/g, ""));
              if (Number.isNaN(number)) return;
              setForm((prev) => ({ ...prev, price: number }));
            }}
            placeholder={
              adjustedPriceMin != null && adjustedPriceMax != null
                ? `Recomendado: ${formatNumber(adjustedPriceMin)} - ${formatNumber(adjustedPriceMax)}`
                : "Introduce un precio para tu publicación"
            }
            underlineColorAndroid="transparent"
            placeholderTextColor={colors.SECONDARY_TEXT}
            placeholderClassName="text-secondary-text"
            className="w-full p-2 px-3 text-lg text-credits"
          />
        </View>
        <Text className="mt-1 text-right text-sm text-secondary-text">
          {form.price && adjustedPriceMax != null && form.price > adjustedPriceMax
            ? `Recomendado: Max. ${formatNumber(adjustedPriceMax)}`
            : ""}
          {form.price && adjustedPriceMin != null && form.price < adjustedPriceMin
            ? `Recomendado: Min. ${formatNumber(adjustedPriceMin)}`
            : ""}
        </Text>
      </>
    ),
  };
  // Field order matches the original, unpaired layout exactly (Images, Category, Title,
  // Description, ProductStatus, Price) so mobile — which always stacks a row's fields full width,
  // one per line — renders byte-for-byte the same as before. Pairing only changes from `md` up:
  // Category+Title (both short, filled right after adding photos) and ProductStatus+Price (price's
  // recommended-range placeholder is literally derived from the selected status, so showing them
  // side by side reinforces that link). Description stays alone because it is multiline.
  const rows: Row[] = [
    { key: "images-row", fields: [imagesField] },
    { key: "category-title-row", fields: [categoryField, titleField] },
    { key: "description-row", fields: [descriptionField] },
    { key: "status-price-row", fields: [productStatusField, priceField] },
  ];
  return (
    <MainView>
      <AvoidingKeyboard>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          refreshControl={<CustomRefresh />}
          className="flex-1"
          contentContainerClassName={contentContainerClassName}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          renderItem={({ item: row }) => (
            <View
              className={twMerge(
                "w-full",
                // A paired row stacks full width on mobile (unchanged from before) and sits
                // side by side from `md` up; a single-field row is always full width.
                row.fields.length > 1 ? "flex-col gap-2 md:flex-row md:gap-4" : undefined,
              )}
            >
              {row.fields.map((field) => (
                <View
                  key={field.key}
                  className={twMerge(
                    row.fields.length > 1 ? "w-full md:flex-1" : "w-full",
                    "gap-2",
                    field.spacingClassName,
                  )}
                >
                  {field.title && <Text className="px-4 text-2xl">{field.title}</Text>}
                  <View>
                    {field.isError && (
                      <Error textClassName="text-sm text-alert px-4">
                        Por favor revisa este campo.
                      </Error>
                    )}
                    <View className="px-4">{field.component()}</View>
                  </View>
                </View>
              ))}
            </View>
          )}
          ListFooterComponent={() => (
            <>
              {isUploadFilesError && <Error>Ha ocurrido un error al subir los archivos.</Error>}
              {isPublishListingError && (
                <Error>Ha ocurrido un error al publicar la publicación.</Error>
              )}
              {isUpdateListingError && (
                <Error>Ha ocurrido un error al actualizar la publicación.</Error>
              )}
              {(isPublishingListing || isUpdatingListing || isUploadingFiles) && <Loader />}
              <CustomButton className="m-4 mb-6" onPress={handleSubmit}>
                <ButtonText>{action === "edit" ? "Actualizar" : "Publicar"}</ButtonText>
              </CustomButton>
            </>
          )}
          ListHeaderComponent={() =>
            backButton ? (
              <Pressable onPress={() => router.back()} className="p-4">
                <BackIcon />
              </Pressable>
            ) : null
          }
        />
      </AvoidingKeyboard>
    </MainView>
  );
}
