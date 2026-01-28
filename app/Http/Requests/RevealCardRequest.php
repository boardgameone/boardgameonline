<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RevealCardRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'reveal_type' => 'required|in:ask_highest,ask_lowest,flip_middle',
            'target_player_id' => 'required_if:reveal_type,ask_highest,ask_lowest|exists:game_players,id',
            'middle_position' => 'required_if:reveal_type,flip_middle|integer|min:0',
            'card_value' => 'nullable|integer|min:0|max:12',
        ];
    }

    public function messages(): array
    {
        return [
            'reveal_type.required' => 'You must specify a reveal type.',
            'reveal_type.in' => 'Invalid reveal type.',
            'target_player_id.required_if' => 'You must select a player to ask.',
            'target_player_id.exists' => 'The selected player does not exist.',
            'middle_position.required_if' => 'You must select a card position.',
            'middle_position.integer' => 'Card position must be a valid number.',
            'middle_position.min' => 'Card position must be valid.',
            'card_value.required' => 'Card value is required.',
            'card_value.integer' => 'Card value must be a number.',
            'card_value.min' => 'Card value must be between 1 and 12.',
            'card_value.max' => 'Card value must be between 1 and 12.',
        ];
    }
}
