import { useEffect, useState, type JSX } from "react";
import { View, Text, FlatList, TextInput, Pressable } from "react-native";
import {
  MAX_LISTING_DESCRIPTION_LENGTH,
  MAX_LISTING_TITLE_LENGTH,
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

interface Section {
  key: string;
  title?: string;
  isError: boolean;
  component: () => JSX.Element;
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
    if (
      (isPublishSuccess && listingData?.listing?.id) ||
      (isUpdateSuccess && initialData?.id)
    ) {
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
          queryKey: ["listing", { listingId: initialData?.id }],
        });
        router.back();
      }
    }
  }, [
    isPublishSuccess,
    isUpdateSuccess,
    router,
    listingData,
    initialData,
    action,
    queryClient,
  ]);

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
    if (form.category?.price?.max && form.price! > form.category?.price?.max) {
      newErrors.price = true;
    }
    if (form.category?.price?.min && form.price! < form.category?.price?.min) {
      newErrors.price = true;
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
  const sections: Section[] = [
    {
      key: "Images",
      component: () => (
        <ImagesSelector
          onChange={handleImageChange}
          initialImages={initialData?.media}
          className="mb-4"
        />
      ),
      isError: errors.images,
    },
    {
      key: "category",
      title: "Categoría",
      isError: errors.category,
      component: () => (
        <CategorySelector
          value={form.category}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, category: value }))
          }
          className="mx-4 mb-4 bg-secondary-text/10 border-0 border-b border-gray-300 rounded-b-none rounded-t"
          placeholderClassName="text-secondary-text"
        />
      ),
    },
    {
      key: "Title",
      title: "Título",
      isError: errors.title,
      component: () => (
        <View className="px-4">
          <TextInput
            value={form.title || ""}
            onChangeText={(text) => {
              if (text.length > MAX_LISTING_TITLE_LENGTH) return;
              setForm((prev) => ({ ...prev, title: text }));
            }}
            placeholder="Escribe un título para tu publicación"
            className="w-full border-b border-gray-300 p-2 px-3 text-lg bg-secondary-text/10 rounded-t"
            underlineColorAndroid="transparent"
            placeholderClassName="text-secondary-text"
          />
          <Text className="mt-1 text-right text-sm text-secondary-text">
            {form.title && form.title?.length > MAX_LISTING_TITLE_LENGTH - 10
              ? `${form.title.length}/${MAX_LISTING_TITLE_LENGTH}`
              : ""}
          </Text>
        </View>
      ),
    },
    {
      key: "Description",
      title: "Descripción",
      isError: errors.description,
      component: () => (
        <View className="px-4">
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
            className="w-full border-b border-gray-300 p-2 px-3 text-lg bg-secondary-text/10 rounded-t"
            placeholderClassName="text-secondary-text"
            underlineColorAndroid="transparent"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Text className="mt-1 text-right text-sm text-secondary-text">
            {form.description &&
            form.description?.length > MAX_LISTING_DESCRIPTION_LENGTH - 50
              ? `${form.description.length}/${MAX_LISTING_DESCRIPTION_LENGTH}`
              : ""}
          </Text>
        </View>
      ),
    },
    {
      key: "price",
      title: "Precio",
      isError: errors.price,
      component: () => (
        <View className="px-4">
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
                form.category?.price?.min && form.category.price.max
                  ? `${formatNumber(form.category?.price?.min)} - ${formatNumber(form.category?.price?.max)}`
                  : "Introduce un precio para tu publicación"
              }
              underlineColorAndroid="transparent"
              placeholderClassName="text-secondary-text"
              className="w-full p-2 px-3 text-lg text-credits"
            />
          </View>
          <Text className="mt-1 text-right text-sm text-secondary-text">
            {form.price &&
            form.category?.price?.max &&
            form.price > form.category?.price?.max
              ? `Max. ${formatNumber(form.category?.price?.max)}`
              : ""}
            {form.price &&
            form.category?.price?.min &&
            form.price < form.category?.price?.min
              ? `Min. ${formatNumber(form.category?.price?.min)}`
              : ""}
          </Text>
        </View>
      ),
    },
    {
      key: "productStatus",
      title: "Estado",
      isError: errors.productStatus,
      component: () => (
        <ProductStatusSelector
          value={form.productStatus}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, productStatus: value }))
          }
          className="mx-4 mb-4 bg-secondary-text/10 border-b border-gray-300 rounded-b-none rounded-t"
        />
      ),
    },
  ];
  return (
    <AvoidingKeyboard>
      <FlatList
        data={sections}
        keyExtractor={(item) => item.key}
        refreshControl={<CustomRefresh />}
        className="flex-1"
        contentContainerClassName="gap-2"
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        renderItem={({ item }) => (
          <View className="w-full gap-2">
            {item.title && <Text className="px-4 text-2xl">{item.title}</Text>}
            {item.isError && (
              <Error textClassName="text-sm text-alert px-4">
                Por favor revisa este campo.
              </Error>
            )}
            {item.component()}
          </View>
        )}
        ListFooterComponent={() => (
          <>
            {isUploadFilesError && (
              <Error>Ha ocurrido un error al subir los archivos.</Error>
            )}
            {isPublishListingError && (
              <Error>Ha ocurrido un error al publicar la publicación.</Error>
            )}
            {isUpdateListingError && (
              <Error>Ha ocurrido un error al actualizar la publicación.</Error>
            )}
            {(isPublishingListing || isUpdatingListing || isUploadingFiles) && (
              <Loader />
            )}
            <CustomButton className="m-4 mb-6" onPress={handleSubmit}>
              <ButtonText>
                {action === "edit" ? "Actualizar" : "Publicar"}
              </ButtonText>
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
  );
}
