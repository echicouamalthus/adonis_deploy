import { useQuery } from "@tanstack/react-query";
import { tuyau } from "../tuyau";

export const useHello = () => {
  return useQuery({
    queryKey: ["hello"],
    queryFn: async () => {
      const response = await tuyau.api.hello.$get();

      if (response.error) {
        throw new Error(response.error.value as string);
      }

      return response.data;
    },
  });
};
