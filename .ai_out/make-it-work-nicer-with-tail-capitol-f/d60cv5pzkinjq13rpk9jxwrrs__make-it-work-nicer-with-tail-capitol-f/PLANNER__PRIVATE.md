# Private Context: Line Filtering Implementation

## Implementation Notes

### Alternative Approaches Considered

1. **Filter in StdinReader**
   - Pros: Filtering happens at the source
   - Cons: Violates SRP - StdinReader should be a generic line reader, not have `tail -F` specific knowledge
   - Decision: Rejected

2. **Filter in JsonParser**
   - Pros: All "non-JSON" handling in one place
   - Cons: JsonParser should only care about JSON parsing semantics, not about specific tool output formats
   - Decision: Rejected

3. **Create separate LineFilter class**
   - Pros: Single responsibility, testable in isolation
   - Cons: Over-engineering for a simple 2-condition filter (violates 80/20)
   - Decision: Rejected - KISS principle favors a simple private method

### Why Static Method

`shouldIgnoreLine` is a pure function with no dependencies on instance state. Making it static:
- Makes this purity explicit
- Allows potential reuse if needed in the future
- Easier to test in isolation if needed

### Testing Strategy Details

Since `shouldIgnoreLine` is private, we test it through the public interface:
1. Create a mock `IpcSender` that records all `send()` calls
2. Feed various lines through `handleLine()`
3. Verify the mock received (or didn't receive) appropriate IPC messages

For more direct testing, we could:
- Make `shouldIgnoreLine` package-private (not exported) and import in test
- Or extract to a separate utility module

Given the simplicity, testing through the public interface is sufficient.

### Potential Future Enhancements (Out of Scope)

1. **Configurable ignore patterns** - Allow users to add custom regex patterns to ignore
2. **Statistics** - Track how many lines were ignored and display in UI
3. **Debug mode** - Log ignored lines for troubleshooting

These are explicitly out of scope for this task but noted for future consideration.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Regex matches valid JSON accidentally | Very Low | Medium | Pattern is specific enough (`^==> .+ <==$`) that it won't match JSON |
| Performance regression | Very Low | Low | Filter is O(1), negligible overhead |
| Breaking existing behavior | Low | Medium | Existing tests + new tests will catch |

## Rollback Plan

If issues arise, the change is trivial to revert:
1. Remove the `shouldIgnoreLine()` check from `handleLine()`
2. Delete the constant and method
3. All existing behavior restored
