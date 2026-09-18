import { useCallback } from "react";

import { FilterOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import { Collapse, Flex, Skeleton } from "antd";

import { AboutCard } from "../components/AboutCard";
import { MatchingSection } from "../components/MatchingSection";
import { PreferencesLoadError } from "../components/PreferencesLoadError";
import { SaveBar } from "../components/SaveBar";
import { SearchSection } from "../components/SearchSection";
import { useAboutForm } from "../hooks/useAboutForm";
import { useDirtyForm } from "../hooks/useDirtyForm";
import { usePersistedKeys } from "../hooks/usePersistedKeys";
import {
  usePreferences,
  useSaveMatchingPreferences,
  useSaveSearchPreferences,
} from "../hooks/usePreferences";
import { useRematchPrompt } from "../hooks/useRematchPrompt";
import { useSavedFlash } from "../hooks/useSavedFlash";
import type { MatchingPreferences, SearchPreferences } from "../types";
import { EMPTY_PREFERENCES } from "../types";

export const JobPreferencesTab = () => {
  const { data: preferences, isLoading, isError, isFetching, refetch } = usePreferences();
  const saveSearchMutation = useSaveSearchPreferences();
  const saveMatchingMutation = useSaveMatchingPreferences();
  const suggestRematch = useRematchPrompt();

  const initial = preferences ?? EMPTY_PREFERENCES;
  const aboutForm = useAboutForm(preferences);
  const searchForm = useDirtyForm<SearchPreferences>(initial.search);
  const matchingForm = useDirtyForm<MatchingPreferences>(initial.matching);
  const searchSaved = useSavedFlash();
  const matchingSaved = useSavedFlash();

  const { keys: activeKeys, setKeys: setActiveKeys } = usePersistedKeys();

  const handleGenerate = useCallback(() => {
    aboutForm.generateMutation.mutate(undefined, {
      onSuccess: (result) => {
        searchForm.setForm((prev) => ({
          ...prev,
          categories: result.categories,
          locations: result.locations,
          disabledSources: result.disabledSources,
          remoteOnly: result.remoteOnly,
        }));
        matchingForm.setForm((prev) => ({
          ...prev,
          excludedKeywords: result.excludedKeywords,
        }));
      },
    });
  }, [aboutForm, searchForm, matchingForm]);

  const updateSearch = useCallback(
    <K extends keyof SearchPreferences>(key: K, value: SearchPreferences[K]) =>
      searchForm.setForm((prev) => ({ ...prev, [key]: value })),
    [searchForm]
  );

  const updateMatching = useCallback(
    <K extends keyof MatchingPreferences>(key: K, value: MatchingPreferences[K]) =>
      matchingForm.setForm((prev) => ({ ...prev, [key]: value })),
    [matchingForm]
  );

  if (isLoading) return <Skeleton active paragraph={{ rows: 14 }} />;
  if (isError || !preferences) {
    return <PreferencesLoadError retrying={isFetching} onRetry={() => void refetch()} />;
  }

  return (
    <Collapse
      activeKey={activeKeys}
      onChange={setActiveKeys}
      items={[
        {
          key: "about",
          label: "About",
          extra: <UserOutlined />,
          children: (
            <AboutCard
              about={aboutForm.about}
              onAboutChange={aboutForm.change}
              onDiscard={aboutForm.discard}
              onSaveText={aboutForm.saveText}
              onUploadFile={aboutForm.uploadFile}
              onGenerate={handleGenerate}
              onOptimize={aboutForm.optimize}
              saving={aboutForm.saving}
              generating={aboutForm.generating}
              optimizing={aboutForm.optimizing}
              aboutDirty={aboutForm.dirty}
              aboutSaved={aboutForm.saved}
            />
          ),
        },
        {
          key: "search",
          label: "Search Criteria",
          extra: <SearchOutlined />,
          children: (
            <Flex vertical gap={16}>
              <SearchSection form={searchForm.form} onChange={updateSearch} />
              <SaveBar
                isDirty={searchForm.isDirty}
                saved={searchSaved.saved}
                saving={saveSearchMutation.isPending}
                onSave={() =>
                  saveSearchMutation.mutate(searchForm.form, {
                    onSuccess: () => {
                      searchSaved.flash();
                      suggestRematch();
                    },
                  })
                }
                onDiscard={searchForm.reset}
              />
            </Flex>
          ),
        },
        {
          key: "matching",
          label: "Matching & Filtering",
          extra: <FilterOutlined />,
          children: (
            <Flex vertical gap={16}>
              <MatchingSection form={matchingForm.form} onChange={updateMatching} />
              <SaveBar
                isDirty={matchingForm.isDirty}
                saved={matchingSaved.saved}
                saving={saveMatchingMutation.isPending}
                onSave={() =>
                  saveMatchingMutation.mutate(matchingForm.form, {
                    onSuccess: () => {
                      matchingSaved.flash();
                      suggestRematch();
                    },
                  })
                }
                onDiscard={matchingForm.reset}
              />
            </Flex>
          ),
        },
      ]}
    />
  );
};
