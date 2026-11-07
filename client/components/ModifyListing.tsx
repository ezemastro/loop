import { useEffect, useState, type JSX } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
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
import { Field, TextField } from "./bases/Field";

interface FormField {
  key: string;
  title?: string;
  isError: boolean;
  component: () => JSX.Element;
}
/**
 * A `Row` holds one field (always full width) or two fields (paired side by side from `md` up,
 * stacked full width on mobile — see `renderItem` below). Grouping stays adjacent to the
 * original field order so mobile requires zero reordering.
 */
interface Row {
  key: string;
  fields: FormField[];
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
  // A form column does not benefit from the full "wide" page cap (1400px) — the narrower page
  // tier keeps fields readable while still leaving room for the md+ side-by-side pairs below.
  const contentContainerClassName = pageContentClassName("narrow", "gap-4 px-4");

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
  const imagesField: FormField = {
    key: "Images",
    isError: errors.images,
    component: () => (
      <ImagesSelector onChange={handleImageChange} initialImages={initialData?.media} />
    ),
  };
  const categoryField: FormField = {
    key: "category",
    title: "Categoría",
    isError: errors.category,
    component: () => (
      <CategorySelector
        value={form.category}
        onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
        invalid={errors.category}
      />
    ),
  };
  const titleField: FormField = {
    key: "Title",
    title: "Título",
    isError: errors.title,
    component: () => (
      <>
        <TextField
          value={form.title || ""}
          invalid={errors.title}
          onChangeText={(text) => {
            if (text.length > MAX_LISTING_TITLE_LENGTH) return;
            setForm((prev) => ({ ...prev, title: text }));
          }}
          placeholder="Escribí un título para tu publicación"
        />
        <Text className="mt-1 text-right text-sm text-secondary-text">
          {form.title && form.title?.length > MAX_LISTING_TITLE_LENGTH - 10
            ? `${form.title.length}/${MAX_LISTING_TITLE_LENGTH}`
            : ""}
        </Text>
      </>
    ),
  };
  const descriptionField: FormField = {
    key: "Description",
    title: "Descripción",
    isError: errors.description,
    component: () => (
      <>
        <TextField
          value={form.description || ""}
          invalid={errors.description}
          onChangeText={(text) => {
            if (text.length > MAX_LISTING_DESCRIPTION_LENGTH) return;
            setForm((prev) => ({ ...prev, description: text }));
          }}
          placeholder="Escribí una descripción para tu publicación"
          multiline
          numberOfLines={5}
        />
        <Text className="mt-1 text-right text-sm text-secondary-text">
          {form.description && form.description?.length > MAX_LISTING_DESCRIPTION_LENGTH - 50
            ? `${form.description.length}/${MAX_LISTING_DESCRIPTION_LENGTH}`
            : ""}
        </Text>
      </>
    ),
  };
  const productStatusField: FormField = {
    key: "productStatus",
    title: "Estado",
    isError: errors.productStatus,
    component: () => (
      <ProductStatusSelector
        value={form.productStatus}
        // This is a form field, not a filter: the empty option reads as a prompt to choose.
        emptyLabel="Elegí el estado"
        onChange={(value) => setForm((prev) => ({ ...prev, productStatus: value }))}
        invalid={errors.productStatus}
      />
    ),
  };
  const priceField: FormField = {
    key: "price",
    title: "Loopies",
    isError: errors.price,
    component: () => (
      <>
        <TextField
          value={form.price ? formatNumber(form.price) : ""}
          invalid={errors.price}
          keyboardType="numeric"
          leading={<CreditIcon size={22} />}
          className="text-credits"
          onChangeText={(text) => {
            const number = Number(text.replace(/[.,]/g, ""));
            if (Number.isNaN(number)) return;
            setForm((prev) => ({ ...prev, price: number }));
          }}
          placeholder={
            adjustedPriceMin != null && adjustedPriceMax != null
              ? `Recomendado: ${formatNumber(adjustedPriceMin)} - ${formatNumber(adjustedPriceMax)}`
              : "Ej.: 500"
          }
        />
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
  // One column, in the order a person fills the form. Only Estado + Loopies pair up from `md`
  // up: the price placeholder is derived from the selected status, so side by side they read as
  // one decision.
  const rows: Row[] = [
    { key: "images-row", fields: [imagesField] },
    { key: "category-row", fields: [categoryField] },
    { key: "title-row", fields: [titleField] },
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
                row.fields.length > 1 ? "flex-col gap-4 md:flex-row" : undefined,
              )}
            >
              {row.fields.map((field) => (
                <Field
                  key={field.key}
                  label={field.title}
                  error={field.isError ? "Revisá este campo." : null}
                  className={row.fields.length > 1 ? "w-full md:flex-1" : "w-full"}
                >
                  {field.component()}
                </Field>
              ))}
            </View>
          )}
          ListFooterComponent={() => (
            <>
              {isUploadFilesError && <Error>No pudimos subir los archivos. Probá de nuevo.</Error>}
              {isPublishListingError && <Error>No pudimos publicar. Probá de nuevo.</Error>}
              {isUpdateListingError && (
                <Error>No pudimos guardar los cambios. Probá de nuevo.</Error>
              )}
              {(isPublishingListing || isUpdatingListing || isUploadingFiles) && <Loader />}
              <CustomButton className="mb-6 mt-6 max-w-none" onPress={handleSubmit}>
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
